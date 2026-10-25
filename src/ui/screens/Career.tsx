import { useEffect, useState } from 'react';
import type { Screen } from '../App';
import { trackThumb } from '../../app/thumbs';
import { bikeById, bikeStats } from '../../content/bikes';
import { LEVELS, QUALIFY_PLACE } from '../../content/career';
import { TRACKS } from '../../content/tracks';
import { levelCleared, unlockedLevel, type SaveData } from '../../save/save';
import { BikeArt } from '../art/BikeArt';
import { GameIcon } from '../art/Icons';
import { money, ordinal } from '../format';
import { Fact, TopNav } from '../parts';

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
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
  const bike = bikeById(save.selectedBike);
  const best = results[track.id];

  // Track previews are drawn by the engine after the first paint, one per frame.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const stats = bikeStats(bike, save.bikes[bike.id].upgrades);
    let i = 0;
    const next = () => {
      if (cancelled || i >= TRACKS.length) return;
      const t = TRACKS[i++];
      const url = trackThumb(t, stats);
      if (url) setThumbs((m) => ({ ...m, [t.id]: url }));
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
    return () => {
      cancelled = true;
    };
    // Previews do not depend on the bike's look, so build them once.
  }, []);

  return (
    <div className="scr">
      <div className="wrap">
        <TopNav title="Career" onBack={() => go('title')} cash={save.cash} />

        <div className="ladder" role="tablist" aria-label="Levels">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              role="tab"
              aria-selected={l.level === level}
              className={`rung${l.level === level ? ' on' : ''}${levelCleared(save, l.level) ? ' cleared' : ''}`}
              disabled={l.level > unlocked}
              onClick={() => setLevel(l.level)}
            >
              <b>{l.level > unlocked ? <GameIcon name="lock" className="inline" /> : l.level}</b>
              <span>{l.level > unlocked ? 'Locked' : l.name}</span>
            </button>
          ))}
        </div>

        <div className="career-grid">
          <div className="tracks">
            {TRACKS.map((t) => {
              const place = results[t.id];
              const ok = place !== undefined && place <= QUALIFY_PLACE;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`track${t.id === trackId ? ' on' : ''}`}
                  onClick={() => setTrackId(t.id)}
                  style={{ ['--sky-c' as string]: t.palette.sky[1], ['--ground-c' as string]: t.palette.ground[0] }}
                  aria-pressed={t.id === trackId}
                >
                  {thumbs[t.id] && <img src={thumbs[t.id]} alt="" />}
                  <span className={`place${ok ? ' ok' : place ? ' try' : ''}`}>{place ? `Best ${ordinal(place)}` : 'New'}</span>
                  <span className="tname display">{t.name}</span>
                </button>
              );
            })}
          </div>

          <div className="panel race-card">
            <div>
              <div className="eyebrow">
                Level {L.level} {L.name}
              </div>
              <h3 className="display">{track.name}</h3>
              <p className="muted">{track.blurb}</p>
            </div>
            <div className="facts">
              <Fact label="1st prize">{money(L.prize[0])}</Fact>
              <Fact label="Your best">{best ? ordinal(best) : 'None'}</Fact>
              <Fact label="Police">{L.cops ? money(L.fine) : 'Off'}</Fact>
            </div>
            <div>
              <div className="progress-line" aria-label={`${TRACKS.filter((t) => (results[t.id] ?? 99) <= QUALIFY_PLACE).length} of 4 tracks qualified`}>
                {TRACKS.map((t) => (
                  <i key={t.id} className={(results[t.id] ?? 99) <= QUALIFY_PLACE ? 'on' : ''} />
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>
                Finish {ordinal(QUALIFY_PLACE)} or better on all 4 tracks to {level < LEVELS.length ? `unlock level ${level + 1}` : 'finish the career'}.
              </p>
            </div>
            <button type="button" className="rider-chip" onClick={() => go('garage')} aria-label={`Change bike. Riding ${bike.name}`}>
              <BikeArt bikeId={bike.id} color={bike.color} upgrades={save.bikes[bike.id].upgrades} title={bike.name} />
              <span>
                <b>{bike.name}</b>
                <br />
                <span className="small muted">Tap to change or upgrade</span>
              </span>
              <span aria-hidden="true">&rsaquo;</span>
            </button>
            <button type="button" className="btn wide" data-primary onClick={() => race(level, track.id)}>
              Race
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
