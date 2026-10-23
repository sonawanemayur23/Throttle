import { useState } from 'react';
import type { Screen } from '../App';
import { BIKES, MAX_UPGRADE, UPGRADE_INFO, UPGRADE_KINDS, bikeStats, upgradeCost, STOCK, type BikeDef } from '../../content/bikes';
import { buyBike, buyUpgrade, type SaveData } from '../../save/save';
import { money } from '../format';

interface Props {
  save: SaveData;
  setSave: (s: SaveData) => void;
  go: (s: Screen) => void;
  back: () => void;
}

// Stat bars are drawn against the best possible value in the game.
const best = bikeStats(BIKES[BIKES.length - 1], { engine: MAX_UPGRADE, tyres: MAX_UPGRADE, armour: MAX_UPGRADE });

export function Garage({ save, setSave, back }: Props) {
  const [viewId, setViewId] = useState(save.selectedBike);
  const [msg, setMsg] = useState<string | null>(null);
  const bike = BIKES.find((b) => b.id === viewId) ?? BIKES[0];
  const owned = save.bikes[bike.id];
  const stats = bikeStats(bike, owned?.upgrades ?? STOCK);

  const act = (r: ReturnType<typeof buyBike>) => {
    if (r.ok) {
      setSave(r.save);
      setMsg(null);
    } else setMsg(r.reason);
  };

  return (
    <div className="screen panel">
      <div className="card wide">
        <header className="bar">
          <button type="button" className="back" onClick={back} aria-label="Back">
            &larr;
          </button>
          <h2 className="h-small">Garage</h2>
          <span className="cash">{money(save.cash)}</span>
        </header>

        <div className="bikes">
          {BIKES.map((b) => (
            <button key={b.id} type="button" className={`bike ${b.id === viewId ? 'on' : ''}`} onClick={() => setViewId(b.id)}>
              <span className="dot" style={{ background: b.color }} aria-hidden="true" />
              <span className="bname">{b.name}</span>
              <span className="bprice">{save.bikes[b.id] ? (save.selectedBike === b.id ? 'Riding' : 'Owned') : money(b.price)}</span>
            </button>
          ))}
        </div>

        <div className="detail column">
          <div>
            <b>{bike.name}</b>
            <p>{bike.blurb}</p>
          </div>
          <div className="stats-bars">
            <StatBar label="Top speed" value={stats.topSpeed} max={best.topSpeed} />
            <StatBar label="Acceleration" value={stats.accel} max={best.accel} />
            <StatBar label="Grip" value={stats.handling} max={best.handling} />
            <StatBar label="Health" value={stats.hp} max={best.hp} />
          </div>

          {owned ? (
            <>
              <div className="upgrades">
                {UPGRADE_KINDS.map((k) => {
                  const lvl = owned.upgrades[k];
                  const maxed = lvl >= MAX_UPGRADE;
                  const cost = maxed ? 0 : upgradeCost(bike, lvl + 1);
                  return (
                    <div key={k} className="upgrade">
                      <div>
                        <b>{UPGRADE_INFO[k].label}</b>
                        <span className="muted">{UPGRADE_INFO[k].effect}</span>
                      </div>
                      <div className="pips" aria-label={`${lvl} of ${MAX_UPGRADE}`}>
                        {Array.from({ length: MAX_UPGRADE }, (_, i) => (
                          <i key={i} className={i < lvl ? 'on' : ''} />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="buy"
                        disabled={maxed}
                        onClick={() => act(buyUpgrade(save, bike.id, k))}
                      >
                        {maxed ? 'Max' : money(cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
              {save.selectedBike !== bike.id && (
                <button type="button" className="cta" data-primary onClick={() => setSave({ ...save, selectedBike: bike.id })}>
                  Ride this bike
                </button>
              )}
              {save.selectedBike === bike.id && (
                <button type="button" className="cta" data-primary onClick={back}>
                  Done
                </button>
              )}
            </>
          ) : (
            <BuyPanel bike={bike} cash={save.cash} onBuy={() => act(buyBike(save, bike.id))} />
          )}
          <p className="msg" role="status">
            {msg}
          </p>
        </div>
      </div>
    </div>
  );
}

function BuyPanel({ bike, cash, onBuy }: { bike: BikeDef; cash: number; onBuy: () => void }) {
  const short = bike.price - cash;
  return (
    <div className="buy-panel">
      <button type="button" className="cta" data-primary onClick={onBuy} disabled={short > 0}>
        Buy for {money(bike.price)}
      </button>
      {short > 0 && <span className="muted">Win races to earn {money(short)} more.</span>}
    </div>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="statbar">
      <span>{label}</span>
      <div className="track-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
