import { useState } from 'react';
import type { Screen } from '../App';
import { BIKES, MAX_UPGRADE, STOCK, UPGRADE_INFO, UPGRADE_KINDS, bikeStats, upgradeCost, type UpgradeKind } from '../../content/bikes';
import { buyBike, buyUpgrade, type SaveData } from '../../save/save';
import { BikeArt } from '../art/BikeArt';
import { PartArt } from '../art/PartArt';
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
  const bike = BIKES.find((b) => b.id === viewId) ?? BIKES[0];
  const owned = save.bikes[bike.id];
  const up = owned?.upgrades ?? STOCK;
  const stats = bikeStats(bike, up);
  // Preview what the next level of the hovered part would give.
  const preview = hover && owned && up[hover] < MAX_UPGRADE ? bikeStats(bike, { ...up, [hover]: up[hover] + 1 }) : null;
  const riding = save.selectedBike === bike.id;

  const act = (r: ReturnType<typeof buyBike>) => {
    if (r.ok) {
      setSave(r.save);
      setMsg(null);
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
            <BikeArt key={bike.id} className="hero-bike" bikeId={bike.id} color={bike.color} upgrades={up} stage title={bike.name} />
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
                  return (
                    <div
                      key={k}
                      className="part"
                      onPointerEnter={() => setHover(k)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(k)}
                      onBlur={() => setHover(null)}
                    >
                      <PartArt kind={k} level={lvl} />
                      <div>
                        <h4>{UPGRADE_INFO[k].label}</h4>
                        <p>{UPGRADE_INFO[k].effect}</p>
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
                        onClick={() => act(buyUpgrade(save, bike.id, k))}
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
              <button type="button" className="btn wide" data-primary disabled={save.cash < bike.price} onClick={() => act(buyBike(save, bike.id))}>
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
                  {has ? <span className="muted">{save.selectedBike === b.id ? 'Riding' : 'Owned'}</span> : <span className="money">{money(b.price)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
