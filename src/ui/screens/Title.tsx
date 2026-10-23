import type { Screen } from '../App';
import { bikeById } from '../../content/bikes';
import { levelDef } from '../../content/career';
import { unlockedLevel, type SaveData } from '../../save/save';
import { BikeArt } from '../art/BikeArt';
import { IconBook, IconGear, IconWrench } from '../art/Icons';
import { money } from '../format';

export function Title({ save, go }: { save: SaveData; go: (s: Screen) => void }) {
  const lvl = levelDef(unlockedLevel(save));
  const bike = bikeById(save.selectedBike);
  const fresh = save.stats.races === 0;
  return (
    <div className="scr center">
      <div className="wrap narrow title">
        <div className="eyebrow">Prototype</div>
        <h1 className="wordmark display">Throttle</h1>
        <p className="tagline">Race. Punch. Kick. Win.</p>
        <BikeArt className="title-bike" bikeId={bike.id} color={bike.color} upgrades={save.bikes[bike.id]?.upgrades} stage title={bike.name} />
        {!fresh && (
          <div className="status-strip">
            <span>
              Level {lvl.level} {lvl.name}
            </span>
            <span>{bike.name}</span>
            <span className="money">{money(save.cash)}</span>
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn wide" data-primary onClick={() => go('career')}>
            {fresh ? 'Start career' : 'Continue'}
          </button>
          <div className="tiles">
            <button type="button" className="tile" onClick={() => go('garage')}>
              <IconWrench />
              Garage
            </button>
            <button type="button" className="tile" onClick={() => go('help')}>
              <IconBook />
              How to play
            </button>
            <button type="button" className="tile" onClick={() => go('settings')}>
              <IconGear />
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
