import type { Screen } from '../App';
import { unlockedLevel, type SaveData } from '../../save/save';
import { levelDef } from '../../content/career';
import { bikeById } from '../../content/bikes';
import { money } from '../format';

export function Title({ save, go }: { save: SaveData; go: (s: Screen) => void }) {
  const lvl = levelDef(unlockedLevel(save));
  const fresh = save.stats.races === 0;
  return (
    <div className="screen">
      <div className="card">
        <div className="kicker">PROTOTYPE</div>
        <h1>THROTTLE</h1>
        <p className="tag">Race. Punch. Kick. Win.</p>
        {!fresh && (
          <div className="title-status">
            <span>Level {lvl.level}, {lvl.name}</span>
            <span>{bikeById(save.selectedBike).name}</span>
            <span className="cash">{money(save.cash)}</span>
          </div>
        )}
        <div className="actions">
          <button type="button" className="cta" data-primary onClick={() => go('career')}>
            {fresh ? 'Start career' : 'Continue'}
          </button>
          <div className="row">
            <button type="button" className="ghost" onClick={() => go('garage')}>
              Garage
            </button>
            <button type="button" className="ghost" onClick={() => go('help')}>
              How to play
            </button>
            <button type="button" className="ghost" onClick={() => go('settings')}>
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
