import type { LastRace } from '../App';
import { levelDef, QUALIFY_PLACE } from '../../content/career';
import { trackById } from '../../content/tracks';
import type { SaveData } from '../../save/save';
import { formatTime, money, ordinal } from '../format';

interface Props {
  last: LastRace;
  save: SaveData;
  onAgain: () => void;
  onNext: () => void;
  onCareer: () => void;
  onGarage: () => void;
}

export function ResultsScreen({ last, save, onAgain, onNext, onCareer, onGarage }: Props) {
  const r = last.results;
  const qualified = !r.busted && r.place <= QUALIFY_PLACE;
  const title = r.busted ? 'Busted' : r.place === 1 ? '1st. You win.' : `${ordinal(r.place)} place`;
  return (
    <div className="screen">
      <div className="card">
        <div className="kicker">
          RACE {save.stats.races} &middot; {trackById(r.trackId).name.toUpperCase()} &middot; LEVEL {r.level}
        </div>
        <h2>{title}</h2>
        {last.unlocked && <div className="banner">Level {last.unlocked} unlocked: {levelDef(last.unlocked).name}</div>}
        {!last.unlocked && !r.busted && (
          <p className="lead small">{qualified ? 'Qualified on this track.' : `Finish ${ordinal(QUALIFY_PLACE)} or better to qualify.`}</p>
        )}
        <div className="stats">
          <div>
            <span>Time</span>
            <b>{formatTime(r.time)}</b>
          </div>
          <div>
            <span>Knockouts</span>
            <b>{r.kos}</b>
          </div>
          {r.copKos > 0 && (
            <div>
              <span>Police knocked down</span>
              <b>{r.copKos}</b>
            </div>
          )}
          <div>
            <span>Near misses</span>
            <b>{r.nearMisses}</b>
          </div>
          <div>
            <span>Best combo</span>
            <b>x{r.topCombo}</b>
          </div>
          <div>
            <span>Prize</span>
            <b>{money(r.prize)}</b>
          </div>
          {r.busted && (
            <div className="bad">
              <span>Police fine</span>
              <b>-{money(r.fine)}</b>
            </div>
          )}
        </div>
        <div className="score">
          <span>Earned</span>
          <b>{money(last.earnings - r.fine)}</b>
        </div>
        <div className="best">
          {last.newBest ? 'New best on this track. ' : ''}Cash {money(last.cashAfter)}
        </div>
        <div className="actions">
          <button type="button" className="cta" data-primary onClick={qualified ? onNext : onAgain}>
            {qualified ? 'Next track' : 'Race again'}
          </button>
          <div className="row">
            {qualified && (
              <button type="button" className="ghost" onClick={onAgain}>
                Race again
              </button>
            )}
            <button type="button" className="ghost" onClick={onGarage}>
              Garage
            </button>
            <button type="button" className="ghost" onClick={onCareer}>
              Career
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
