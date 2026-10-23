import type { LastRace } from '../App';
import { levelDef, QUALIFY_PLACE } from '../../content/career';
import { trackById } from '../../content/tracks';
import type { SaveData } from '../../save/save';
import { formatTime, money, ordinal } from '../format';
import { Fact } from '../parts';

interface Props {
  last: LastRace;
  save: SaveData;
  onAgain: () => void;
  onNext: () => void;
  onCareer: () => void;
  onGarage: () => void;
}

const suffix = (n: number) => ordinal(n).slice(String(n).length);

export function ResultsScreen({ last, save, onAgain, onNext, onCareer, onGarage }: Props) {
  const r = last.results;
  const qualified = !r.busted && r.place <= QUALIFY_PLACE;
  const verdict = r.busted ? `Fined ${money(r.fine)}` : r.place === 1 ? 'You win' : qualified ? 'Qualified' : `Top ${QUALIFY_PLACE} to qualify`;
  return (
    <div className="scr center">
      <div className="wrap narrow results">
        <div className="eyebrow">
          Race {save.stats.races} / {trackById(r.trackId).name} / Level {r.level}
        </div>
        <div className={`podium${r.busted ? ' busted' : r.place === 1 ? ' win' : ''}`}>
          {r.busted ? (
            <div className="big display">Busted</div>
          ) : (
            <div className="big display">
              {r.place}
              <sup>{suffix(r.place)}</sup>
            </div>
          )}
          <div className="verdict display">{verdict}</div>
        </div>
        {last.unlocked && <div className="banner">Level {last.unlocked} unlocked: {levelDef(last.unlocked).name}</div>}

        <div className="stat-grid">
          <Fact label="Time">{formatTime(r.time)}</Fact>
          <Fact label="Knockouts">{r.kos + r.copKos}</Fact>
          <Fact label="Near misses">{r.nearMisses}</Fact>
          <Fact label="Best combo">x{r.topCombo}</Fact>
          <Fact label="Prize">{money(r.prize)}</Fact>
          {r.busted ? (
            <Fact label="Fine" bad>
              -{money(r.fine)}
            </Fact>
          ) : (
            <Fact label="Police down">{r.copKos}</Fact>
          )}
        </div>

        <div className="earned">
          <span>Earned</span>
          <b className="money">{money(last.earnings - r.fine)}</b>
        </div>
        <div className="small muted">
          {last.newBest ? 'New best on this track. ' : ''}Cash now {money(last.cashAfter)}
        </div>

        <div className="actions">
          <button type="button" className="btn wide" data-primary onClick={qualified ? onNext : onAgain}>
            {qualified ? 'Next track' : 'Race again'}
          </button>
          <div className="row">
            {qualified && (
              <button type="button" className="btn alt" onClick={onAgain}>
                Again
              </button>
            )}
            <button type="button" className="btn alt" onClick={onGarage}>
              Garage
            </button>
            <button type="button" className="btn alt" onClick={onCareer}>
              Career
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
