import type { LastRace } from '../App';
import { levelDef, QUALIFY_PLACE } from '../../content/career';
import { trackById } from '../../content/tracks';
import type { SaveData } from '../../save/save';
import { formatTime, money, ordinal } from '../format';
import { Fact } from '../parts';
import { useState } from 'react';
import { challengeLink, shareChallenge } from '../../app/challenge';
import { MomentsBox, SharePoll, type MomentSet } from '../MomentsBox';
import { track as logPlay } from '../../app/analytics';
import { GameIcon } from '../art/Icons';

interface Props {
  last: LastRace;
  save: SaveData;
  /** Share Moments: null while the last one is still being filmed. */
  moments: MomentSet | null;
  onAgain: () => void;
  onNext: () => void;
  onCareer: () => void;
  onGarage: () => void;
  /** Save the rider name shown on challenge links. */
  setName: (name: string) => void;
}

const suffix = (n: number) => ordinal(n).slice(String(n).length);

export function ResultsScreen({ last, save, moments, onAgain, onNext, onCareer, onGarage, setName }: Props) {
  const r = last.results;
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [name, setNameDraft] = useState(save.settings.name);
  const vsGhost = last.challenge;
  const beat = vsGhost && !r.busted && r.ghostTime !== undefined && r.time < r.ghostTime;
  const share = async () => {
    if (!last.myGhost) return;
    const ghost = { ...last.myGhost, name: name.trim() };
    if (name !== save.settings.name) setName(name);
    const how = await shareChallenge(ghost, !!daily);
    if (how === 'copied') setShareMsg('Link copied. Paste it to a friend.');
    else if (how === 'failed') setShareMsg('Could not share from this browser.');
    else setShareMsg(null);
    if (how === 'shared' || how === 'copied') logPlay('challenge_sent', { method: how, track: ghost.trackId, reply: vsGhost ? 1 : 0 });
  };
  const daily = last.daily;
  const trackName = trackById(r.trackId).name;
  const dare = r.busted ? `Outrun the police on ${trackName}` : `Beat my ${formatTime(r.time)} on ${trackName}`;
  const clipText = () => {
    const url = last.myGhost ? challengeLink({ ...last.myGhost, name: name.trim() }) : `${location.origin}${location.pathname}`;
    return { text: r.busted ? `Busted on Throttle Bike. Can you outrun them?` : `Throttle Bike. ${dare}:`, url };
  };
  // Daily races are about the time, not the career: the main button is another try.
  const qualified = !daily && !r.busted && r.place <= QUALIFY_PLACE;
  const verdict = r.busted ? (r.fine > 0 ? `Fined ${money(r.fine)}` : 'No fine this time') : daily ? (r.place === 1 ? 'You win' : 'Daily race') : r.place === 1 ? 'You win' : qualified ? 'Qualified' : `Top ${QUALIFY_PLACE} to qualify`;
  return (
    <div className="scr center">
      <div className="wrap narrow results">
        <div className="eyebrow">
          Race {save.stats.races} / {trackById(r.trackId).name} / Level {r.level}
        </div>
        <div className={`podium${r.busted ? ' busted' : r.place === 1 ? ' win' : ''}`}>
          {r.busted ? <GameIcon name="police" className="podium-ico" /> : r.place <= 3 && <GameIcon name="trophy" className="podium-ico" />}
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
        {vsGhost && r.ghostTime !== undefined && (
          <div className={`banner vs${beat ? ' won' : ''}`}>
            {r.busted
              ? `Busted. ${vsGhost.name || 'Your friend'} still holds ${formatTime(r.ghostTime)}.`
              : beat
                ? `You beat ${vsGhost.name || 'your friend'} by ${(r.ghostTime - r.time).toFixed(1)}s`
                : `${vsGhost.name || 'Your friend'} was ${(r.time - r.ghostTime).toFixed(1)}s faster`}
          </div>
        )}
        {daily && (
          <div className={`banner daily-banner${daily.newBest ? ' won' : ''}`}>
            {r.busted
              ? 'Daily race: busted. Try again before the reset.'
              : daily.newBest
                ? `Daily race: new best ${formatTime(r.time)}`
                : `Daily race: your best today is ${daily.best !== null ? formatTime(daily.best) : '-'}`}
            {daily.paid > 0 && <span className="sub">+{money(daily.paid)} daily bonus</span>}
            {daily.streak > 0 && !r.busted && <span className="sub">{daily.streak} day streak</span>}
          </div>
        )}
        {last.unlocked && <div className="banner">Level {last.unlocked} unlocked: {levelDef(last.unlocked).name}</div>}

        <MomentsBox moments={moments} dare={dare} shareText={clipText} />
        <SharePoll races={save.stats.races} />

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
          <span>
            <GameIcon name="cash" className="inline" />
            Earned
          </span>
          <b className="money">{money(last.earnings - r.fine)}</b>
        </div>
        <div className="small muted">
          {last.newBest ? 'New best on this track. ' : ''}Cash now {money(last.cashAfter)}
        </div>

        {last.myGhost && (
          <div className="dare">
            <div className="dare-head">
              <b className="display">{vsGhost ? (beat ? 'Send it back' : 'Dare someone else') : 'Challenge a friend'}</b>
              <span className="muted small">They race your ghost on this track. {formatTime(r.time)} to beat.</span>
            </div>
            <label className="dare-name">
              <span className="small muted">Your name on the link</span>
              <input
                value={name}
                maxLength={16}
                placeholder="A friend"
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="done"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Done or Enter closes the keyboard and keeps the name; it never starts a race.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setName(name);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={() => name !== save.settings.name && setName(name)}
              />
            </label>
            <button type="button" className="btn wide share" onClick={share}>
              Share challenge
            </button>
            {shareMsg && (
              <p className="small" role="status">
                {shareMsg}
              </p>
            )}
          </div>
        )}

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
