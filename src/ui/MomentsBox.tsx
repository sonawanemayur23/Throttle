// Share Moments on the results screen: the race's best moment plays on its own,
// up to two more to pick from, three styles, one share button. The clip is made
// in the background as soon as the results show, because a phone's share sheet
// only opens straight from a tap: it cannot wait for a video to be made.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Moment } from '../engine/replay';
import { canFilm, makeFilm, type ClipStyle, type Film, type Scene } from '../app/film';
import { track as logPlay } from '../app/analytics';

export interface MomentSet {
  list: Moment[];
  scene: Scene;
}

interface Props {
  /** null while the race's last moment is still being filmed. */
  moments: MomentSet | null;
  /** The line on the end card, e.g. "Beat my 1:42.3 on Harbor Run". */
  dare: string;
  /** Text and link for the share sheet. */
  shareText: () => { text: string; url: string };
}

const STYLES: Array<{ id: ClipStyle; label: string; hint: string }> = [
  { id: 'hype', label: 'Hype', hint: 'Slow motion and a beat drop' },
  { id: 'funny', label: 'Funny', hint: 'Freeze frame and OOF' },
  { id: 'clean', label: 'Clean', hint: 'Race sound only' },
];

const SKIP = ['Boring', 'Too long', "Don't share games"];

type Nav = Navigator & { canShare?: (d: ShareData) => boolean };

export function MomentsBox({ moments, dare, shareText }: Props) {
  const ok = useMemo(() => canFilm(), []);
  const [pick, setPick] = useState(0);
  const [style, setStyle] = useState<ClipStyle>('hype');
  const [films, setFilms] = useState<Record<string, Film & { url: string }>>({});
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [skip, setSkip] = useState<'closed' | 'open' | 'done'>('closed');
  const urls = useRef<string[]>([]);
  const list = moments?.list ?? [];
  const moment = list.at(pick);
  const key = `${pick}:${style}`;
  const film = films[key];

  // Make the clip on screen, if it is not made yet. Changing moment or style cancels the one in progress.
  useEffect(() => {
    if (!ok || !moments || !moment || films[key]) return;
    const ctl = new AbortController();
    const t0 = performance.now();
    setProgress(0);
    setFailed(false);
    makeFilm({ moment, scene: moments.scene, style, dare }, (p) => setProgress(p), ctl.signal)
      .then((f) => {
        const url = URL.createObjectURL(f.blob);
        urls.current.push(url);
        setFilms((all) => ({ ...all, [key]: { ...f, url } }));
        logPlay('clip_made', { moment: moment.kind, style, ms: Math.round(performance.now() - t0), format: f.ext, rank: pick + 1 });
      })
      .catch((e) => {
        if ((e as DOMException)?.name === 'AbortError') return;
        console.warn('Share Moments: could not make the clip', e);
        setFailed(true);
      });
    return () => ctl.abort();
    // films is read, not watched: a finished film must not restart this effect.
  }, [ok, moments, moment, key, style, dare, pick]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (!ok) return null;
  if (moments && !list.length) return null;

  const fileName = () => `throttle-bike-${moment?.kind ?? 'moment'}-${style}.${film?.ext ?? 'mp4'}`;

  const save = () => {
    if (!film) return;
    const a = document.createElement('a');
    a.href = film.url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    logPlay('clip_shared', { moment: moment?.kind ?? '', style, method: 'save' });
  };

  const share = async () => {
    if (!film || !moment) return;
    const { text, url } = shareText();
    const file = new File([film.blob], fileName(), { type: film.type });
    const nav = navigator as Nav;
    const data: ShareData = { files: [file], text: `${text} ${url}` };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share(data);
        setMsg(null);
        logPlay('clip_shared', { moment: moment.kind, style, method: 'share' });
      } catch (e) {
        if ((e as DOMException)?.name !== 'AbortError') setMsg('Could not open the share sheet. Save the video and post it from your gallery.');
      }
      return;
    }
    // Desktop and older phones: save the file and copy the dare for the caption.
    save();
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMsg('Video saved. The challenge link is copied for your caption.');
    } catch {
      setMsg('Video saved. Post it with your challenge link.');
    }
  };

  const answerSkip = (a: string) => {
    setSkip('done');
    logPlay('share_poll', { q: 'skip', a, moment: moment?.kind ?? '', style });
  };

  return (
    <section className="moments" aria-label="Share a moment">
      <div className="moments-head">
        <b className="display">{moment ? moment.label : 'Replay'}</b>
        <span className="small muted">{moment ? moment.detail : 'Cutting your best moment...'}</span>
      </div>

      <div className="moments-stage">
        {film ? (
          <video key={film.url} src={film.url} autoPlay loop playsInline muted={muted} onClick={() => setMuted(!muted)} aria-label={`${moment?.label ?? 'Moment'} clip`} />
        ) : (
          <div className="moments-wait">
            {failed ? (
              <span className="small">This browser could not make the clip.</span>
            ) : (
              <>
                <span className="small muted">{moments ? 'Making your clip' : 'Finding your best moment'}</span>
                <div className="moments-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                  <i style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </>
            )}
          </div>
        )}
        {film && (
          <button type="button" className="moments-sound" onClick={() => setMuted(!muted)} aria-pressed={!muted}>
            {muted ? 'Tap for sound' : 'Sound on'}
          </button>
        )}
      </div>

      {list.length > 1 && (
        <div className="moments-picks" role="radiogroup" aria-label="Moment">
          {list.map((m, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === pick} className={`moment-card${i === pick ? ' on' : ''}`} onClick={() => setPick(i)}>
              <b>{m.label}</b>
              <span>{m.detail}</span>
            </button>
          ))}
        </div>
      )}

      <div className="moments-styles" role="radiogroup" aria-label="Style">
        {STYLES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={s.id === style} title={s.hint} className={`style-chip${s.id === style ? ' on' : ''}`} onClick={() => setStyle(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <button type="button" className="btn wide share" data-primary disabled={!film} onClick={share}>
        {film ? 'Share to Status / Story' : `Making clip ${Math.round(progress * 100)}%`}
      </button>
      <div className="moments-foot">
        <button type="button" className="linkish small" disabled={!film} onClick={save}>
          Save video
        </button>
        {skip === 'closed' && (
          <button type="button" className="linkish small muted" onClick={() => setSkip('open')}>
            Not your best moment?
          </button>
        )}
        {skip === 'done' && <span className="small muted">Thanks. We will make it better.</span>}
      </div>
      {skip === 'open' && (
        <div className="moments-skip">
          {SKIP.map((a) => (
            <button key={a} type="button" className="style-chip" onClick={() => answerSkip(a)}>
              {a}
            </button>
          ))}
        </div>
      )}
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

const POLL_KEY = 'throttle-share-poll';
const POLL = ['Takedown', 'Wipeout', 'Photo finish', 'Police chase', 'Nothing'];

/** One question, once, after the third race: what would players actually send? */
export function SharePoll({ races }: { races: number }) {
  const [state, setState] = useState<'ask' | 'done' | 'hidden'>(() => {
    if (races < 3) return 'hidden';
    try {
      return localStorage.getItem(POLL_KEY) ? 'hidden' : 'ask';
    } catch {
      return 'hidden';
    }
  });
  if (state === 'hidden') return null;
  const answer = (a: string) => {
    try {
      localStorage.setItem(POLL_KEY, a);
    } catch {
      /* asked again next time, that is fine */
    }
    logPlay('share_poll', { q: 'send', a });
    setState('done');
  };
  const close = () => {
    try {
      localStorage.setItem(POLL_KEY, 'closed');
    } catch {
      /* nothing */
    }
    setState('hidden');
  };
  return (
    <div className="poll">
      {state === 'ask' ? (
        <>
          <div className="poll-head">
            <b>What would you send a friend?</b>
            <button type="button" className="linkish small muted" onClick={close} aria-label="Close">
              Close
            </button>
          </div>
          <div className="moments-skip">
            {POLL.map((a) => (
              <button key={a} type="button" className="style-chip" onClick={() => answer(a)}>
                {a}
              </button>
            ))}
          </div>
        </>
      ) : (
        <span className="small muted">Thanks. That helps.</span>
      )}
    </div>
  );
}
