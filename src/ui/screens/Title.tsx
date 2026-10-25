import type { Screen } from '../App';
import { bikeById } from '../../content/bikes';
import { levelDef } from '../../content/career';
import { unlockedLevel, type SaveData } from '../../save/save';
import { IconBook, IconGear, IconWrench } from '../art/Icons';
import { titleUrl } from '../../app/uiArt';
import { isIOS, isImmersive, isTouchDevice } from '../../app/gameMode';
import { money, formatTime } from '../format';
import { useEffect, useState } from 'react';
import { dailyFor, dayBefore, untilReset, type DailyRace } from '../../content/daily';
import { trackById } from '../../content/tracks';
import { liveStreak } from '../../save/save';

export function Title({ save, go, onDaily }: { save: SaveData; go: (s: Screen) => void; onDaily: (d: DailyRace) => void }) {
  const lvl = levelDef(unlockedLevel(save));
  const bike = bikeById(save.selectedBike);
  const fresh = save.stats.races === 0;
  return (
    <div className="scr center title-scr">
      {/* Title scene from the Prompt 8 art: wide on landscape screens, tall on portrait. */}
      <picture className="title-bg" aria-hidden="true">
        <source media="(orientation: portrait)" srcSet={titleUrl('tall')} />
        <img src={titleUrl('wide')} alt="" />
      </picture>
      <div className="wrap narrow title">
        <div className="title-top">
          <div className="eyebrow">90s arcade, back on the road</div>
          <h1 className="wordmark display" aria-label="Throttle Bike">
            Throttle<span className="bike">Bike</span>
          </h1>
          <p className="tagline">Race. Punch. Kick. Win.</p>
        </div>
        <div className="title-bottom">
          {!fresh && <DailyCard save={save} onDaily={onDaily} />}
          {!fresh && (
            <div className="status-strip">
              <span>
                Level {lvl.level} {lvl.name}
              </span>
              <span>{bike.name}</span>
              <span className="money">{money(save.cash)}</span>
            </div>
          )}
          {isIOS() && isTouchDevice() && !isImmersive() && <p className="ios-tip">For full screen: tap Share, then Add to Home Screen.</p>}
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
    </div>
  );
}

/** Today's daily race: same track and level for everyone, new every day at 00:00 UTC. */
function DailyCard({ save, onDaily }: { save: SaveData; onDaily: (d: DailyRace) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const d = dailyFor(now);
  const mine = save.daily.key === d.key ? save.daily : null;
  const streak = liveStreak(save, d.key, dayBefore(d.key));
  const lvl = levelDef(d.level);
  return (
    <div className="daily">
      <div className="daily-top">
        <b className="display">Daily race</b>
        <span className="small muted">New in {untilReset(d.resetsIn)}</span>
      </div>
      <div className="daily-mid">
        <span>
          {trackById(d.trackId).name} &middot; Level {lvl.level} {lvl.name}
        </span>
        {streak > 0 && <span className="streak">{streak} day streak</span>}
      </div>
      <p className="small">
        {mine?.best != null ? (
          <>
            Your best today: <b>{formatTime(mine.best)}</b> ({mine.tries} {mine.tries === 1 ? 'try' : 'tries'})
          </>
        ) : (
          <>
            Finish it today for <b className="money">+{money(d.bonus)}</b>
            {streak > 0 ? ' and keep your streak' : ''}.
          </>
        )}
      </p>
      <button type="button" className="btn alt wide" onClick={() => onDaily(d)}>
        {mine?.best != null ? 'Beat your time' : "Race today's"}
      </button>
    </div>
  );
}
