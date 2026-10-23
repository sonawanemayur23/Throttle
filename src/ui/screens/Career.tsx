import type { Screen } from '../App';
import { LEVELS, QUALIFY_PLACE } from '../../content/career';
import { TRACKS } from '../../content/tracks';
import { bikeById } from '../../content/bikes';
import { levelCleared, unlockedLevel, type SaveData } from '../../save/save';
import { money, ordinal } from '../format';

interface Props {
  save: SaveData;
  level: number;
  setLevel: (n: number) => void;
  trackId: string;
  setTrackId: (id: string) => void;
  race: (level: number, trackId: string) => void;
  go: (s: Screen) => void;
}

export function Career({ save, level, setLevel, trackId, setTrackId, race, go }: Props) {
  const unlocked = unlockedLevel(save);
  const L = LEVELS[level - 1];
  const results = save.career[level] ?? {};
  const done = TRACKS.filter((t) => (results[t.id] ?? 99) <= QUALIFY_PLACE).length;
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  return (
    <div className="screen panel">
      <div className="card wide">
        <header className="bar">
          <button type="button" className="back" onClick={() => go('title')} aria-label="Back to title">
            &larr;
          </button>
          <h2 className="h-small">Career</h2>
          <span className="cash">{money(save.cash)}</span>
        </header>

        <div className="levels" role="tablist" aria-label="Levels">
          {LEVELS.map((l) => {
            const locked = l.level > unlocked;
            return (
              <button
                key={l.level}
                type="button"
                role="tab"
                aria-selected={l.level === level}
                className={`level ${l.level === level ? 'on' : ''} ${locked ? 'locked' : ''} ${levelCleared(save, l.level) ? 'cleared' : ''}`}
                disabled={locked}
                onClick={() => setLevel(l.level)}
              >
                <b>{l.level}</b>
                <span>{locked ? 'Locked' : l.name}</span>
              </button>
            );
          })}
        </div>

        <p className="lead small">
          {L.name}: finish {ordinal(QUALIFY_PLACE)} or better on all 4 tracks to unlock{' '}
          {level < LEVELS.length ? `level ${level + 1}` : 'the end of the career'}. Done {done} of 4.
          {L.cops ? ' Police patrol these roads.' : ' No police at this level.'}
        </p>

        <div className="tracks">
          {TRACKS.map((t) => {
            const best = results[t.id];
            const q = best !== undefined && best <= QUALIFY_PLACE;
            return (
              <button
                key={t.id}
                type="button"
                className={`track ${t.id === trackId ? 'on' : ''}`}
                onClick={() => setTrackId(t.id)}
                style={{ ['--sky' as string]: t.palette.sky[1], ['--ground' as string]: t.palette.ground[0] }}
              >
                <span className="swatch" aria-hidden="true" />
                <span className="tname">{t.name}</span>
                <span className={`badge ${q ? 'ok' : best ? 'try' : ''}`}>{best ? `Best ${ordinal(best)}` : 'Not raced'}</span>
              </button>
            );
          })}
        </div>

        <div className="detail">
          <div>
            <b>{track.name}</b>
            <p>{track.blurb}</p>
            <p className="muted">
              Prize for 1st {money(L.prize[0])}. {L.armed} armed {L.armed === 1 ? 'rider' : 'riders'}.
              {L.cops ? ` Busted fine ${money(L.fine)}.` : ''}
            </p>
          </div>
          <div className="detail-actions">
            <button type="button" className="cta" data-primary onClick={() => race(level, track.id)}>
              Race
            </button>
            <button type="button" className="ghost" onClick={() => go('garage')}>
              {bikeById(save.selectedBike).name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
