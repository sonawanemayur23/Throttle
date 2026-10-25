import { useEffect, useState } from 'react';
import { track } from '../../app/analytics';
import type { Screen } from '../App';
import { BIKES, MAX_UPGRADE, STOCK, UPGRADE_INFO, UPGRADE_KINDS, bikeStats, upgradeCost, upgradeGains, type UpgradeKind } from '../../content/bikes';
import { buyBike, buyUpgrade, type SaveData } from '../../save/save';
import { BikeArt } from '../art/BikeArt';
import { PartArt } from '../art/PartArt';
import { GameIcon } from '../art/Icons';
import { money } from '../format';
import { TopNav } from '../parts';

interface Props {
  save: SaveData;
  setSave: (s: SaveData) => void;
  go: (s: Screen) => void;
  back: () => void;
}

// Meters are scaled from the weakest stock bike to the best fully upgraded one.
const FULL = { engine: MAX_UPGRADE, tyres: MAX_UPGRADE, armour: MAX_UPGRADE };
const all = BIKES.flatMap((b) => [bikeStats(b, STOCK), bikeStats(b, FULL)]);
const range = (k: 'topSpeed' | 'accel' | 'handling' | 'hp') => {
  const v = all.map((s) => s[k]);
  return [Math.min(...v) * 0.85, Math.max(...v)] as const;
};
const RANGES = { topSpeed: range('topSpeed'), accel: range('accel'), handling: range('handling'), hp: range('hp') };
const SEGMENTS = 20;

export function Garage({ save, setSave, back }: Props) {
  const [viewId, setViewId] = useState(save.selectedBike);
  const [hover, setHover] = useState<UpgradeKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // The upgrade just bought: drives the celebration banner and glow for a moment.
  const [cheer, setCheer] = useState<{ kind: UpgradeKind; level: number; line: string; n: number } | null>(null);
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(null), 2600);
    return () => clearTimeout(t);
  }, [cheer]);
  const bike = BIKES.find((b) => b.id === viewId) ?? BIKES[0];
  const owned = save.bikes[bike.id];
  const up = owned?.upgrades ?? STOCK;
  const stats = bikeStats(bike, up);
  // Preview what the next level of the hovered part would give.
  const preview = hover && owned && up[hover] < MAX_UPGRADE ? bikeStats(bike, { ...up, [hover]: up[hover] + 1 }) : null;
  const riding = save.selectedBike === bike.id;

  const act = (r: ReturnType<typeof buyBike>, purchase?: { item: string; price: number }) => {
    if (r.ok) {
      setSave(r.save);
      setMsg(null);
      if (purchase) track('purchase', purchase);
    } else setMsg(r.reason);
  };

  const seg = (k: keyof typeof RANGES, v: number) => {
    const [lo, hi] = RANGES[k];
    return Math.max(1, Math.round(((v - lo) / (hi - lo)) * SEGMENTS));
  };

  return (
    <div className="scr">
      <div className="wrap">
        <TopNav title="Garage" onBack={back} cash={save.cash} />

        <div className="garage">
          <div className="showroom">
            <div className="eyebrow klass">{bike.klass}</div>
            <h3 className="bike-name display">{bike.name}</h3>
            <span className={`tag${owned ? ' owned' : ' price'}`}>{riding ? 'Riding' : owned ? 'Owned' : money(bike.price)}</span>
            <BikeArt key={bike.id + (cheer ? cheer.n : '')} className={`hero-bike${cheer ? ' pop' : ''}`} bikeId={bike.id} color={bike.color} upgrades={up} stage title={bike.name} />
            {cheer && (
              <div className={`cheer t${cheer.level}`} role="status" key={cheer.n}>
                <b className="display">
                  {UPGRADE_INFO[cheer.kind].label} level {cheer.level}
                </b>
                <span>{cheer.line}</span>
              </div>
            )}
            <p className="muted small" style={{ margin: '0 0 8px' }}>
              {bike.blurb}
            </p>
          </div>

          <div className="panel" style={{ display: 'grid', gap: 14 }}>
            <div className="specs">
              {(
                [
                  ['Top speed', 'topSpeed', `${Math.round(stats.topSpeed * 250)}`],
                  ['Accel', 'accel', `${Math.round(stats.accel * 100)}`],
                  ['Grip', 'handling', `${Math.round(stats.handling * 100)}`],
                  ['Health', 'hp', `${Math.round(stats.hp)}`],
                ] as const
              ).map(([label, k, shown]) => {
                const now = seg(k, stats[k]);
                const next = preview ? seg(k, preview[k]) : now;
                return (
                  <div className="spec" key={k}>
                    <span>{label}</span>
                    <div className="meter" aria-hidden="true">
                      {Array.from({ length: SEGMENTS }, (_, i) => (
                        <i key={i} className={i < now ? 'on' : i < next ? 'gain' : ''} />
                      ))}
                    </div>
                    <b>{shown}</b>
                  </div>
                );
              })}
            </div>

            {owned ? (
              <div className="parts">
                {UPGRADE_KINDS.map((k) => {
                  const lvl = up[k];
                  const maxed = lvl >= MAX_UPGRADE;
                  const cost = maxed ? 0 : upgradeCost(bike, lvl + 1);
                  const short = !maxed && save.cash < cost;
                  const info = UPGRADE_INFO[k];
                  const gains = maxed ? [] : upgradeGains(bike, up, k);
                  return (
                    <div
                      key={k}
                      className={`part${hover === k ? ' sel' : ''}${cheer?.kind === k ? ' just' : ''}`}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(k)}
                      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
                      onClick={() => setHover(k)}
                      onFocus={() => setHover(k)}
                      onBlur={() => setHover(null)}
                    >
                      <PartArt kind={k} level={lvl} />
                      <div>
                        <h4>{info.label}</h4>
                        <p className="now">{info.parts[lvl]}</p>
                        {maxed ? (
                          <p className="next">Fully upgraded.</p>
                        ) : (
                          <p className="next">
                            <span className="lbl">Next: {info.parts[lvl + 1]}</span>
                            {gains.map((g) => (
                              <span className="gain" key={g.label}>
                                {g.label} {g.from}
                                {g.unit} <i>&rarr;</i> <b>{g.to}{g.unit}</b>
                              </span>
                            ))}
                          </p>
                        )}
                        {hover === k && <p className="feel">{info.feel}</p>}
                        <div className="pips" aria-label={`Level ${lvl} of ${MAX_UPGRADE}`}>
                          {Array.from({ length: MAX_UPGRADE }, (_, i) => (
                            <i key={i} className={i < lvl ? `t${i + 1}` : ''} />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`buy${short ? ' short' : ''}`}
                        disabled={maxed}
                        aria-label={maxed ? `${UPGRADE_INFO[k].label} fully upgraded` : `Upgrade ${UPGRADE_INFO[k].label} for ${money(cost)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = buyUpgrade(save, bike.id, k);
                          act(r, { item: `${bike.id}-${k}`, price: cost });
                          if (r.ok) {
                            const first = gains[0];
                            const diff = first ? first.to - first.from : 0;
                            setCheer({
                              kind: k,
                              level: lvl + 1,
                              line: `${info.parts[lvl + 1]}${first ? `. ${first.label} ${diff > 0 ? '+' : ''}${diff}${first.unit}` : ''}`,
                              n: Date.now(),
                            });
                            try {
                              if (save.settings.vibration) navigator.vibrate?.([18, 40, 28]);
                            } catch {
                              /* not allowed */
                            }
                          }
                        }}
                      >
                        {maxed ? 'Max' : money(cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                {save.cash >= bike.price ? 'You can afford this bike.' : `Win races to earn ${money(bike.price - save.cash)} more.`}
              </p>
            )}

            <p className="msg" role="status">
              {msg}
            </p>

            {!owned && (
              <button type="button" className="btn wide" data-primary disabled={save.cash < bike.price} onClick={() => act(buyBike(save, bike.id), { item: bike.id, price: bike.price })}>
                Buy for {money(bike.price)}
              </button>
            )}
            {owned && !riding && (
              <button type="button" className="btn wide" data-primary onClick={() => setSave({ ...save, selectedBike: bike.id })}>
                Ride this bike
              </button>
            )}
            {owned && riding && (
              <button type="button" className="btn wide" data-primary onClick={back}>
                Done
              </button>
            )}
          </div>

          <div className="bike-rail" role="listbox" aria-label="Bikes">
            {BIKES.map((b) => {
              const has = !!save.bikes[b.id];
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={b.id === viewId}
                  className={`rail-item${b.id === viewId ? ' on' : ''}${has ? '' : ' locked'}`}
                  onClick={() => {
                    setViewId(b.id);
                    setMsg(null);
                  }}
                >
                  <BikeArt bikeId={b.id} color={b.color} upgrades={save.bikes[b.id]?.upgrades} title={b.name} />
                  <b>{b.name}</b>
                  {has ? (
                    <span className="muted">{save.selectedBike === b.id ? 'Riding' : 'Owned'}</span>
                  ) : (
                    <span className="money">
                      <GameIcon name="lock" className="inline" />
                      {money(b.price)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
