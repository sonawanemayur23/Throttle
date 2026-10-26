// The race's best moment as a 10 second video (P3-03): pick the sound, make
// the clip, then share it to WhatsApp Status or an Instagram Story through the
// phone's share sheet, or save it. Two taps on purpose: phones only allow the
// share sheet straight after a tap, and making the clip takes about 10 seconds.

import { useEffect, useState } from 'react';
import type { Clip } from '../app/clip';
import { exportClip, saveClip, shareClip, type ClipSound, type ExportedClip } from '../app/clipExport';
import { track as logPlay } from '../app/analytics';
import { trackById } from '../content/tracks';

const SOUNDS: Array<[ClipSound, string]> = [
  ['game', 'Race sound'],
  ['coast', 'Coast beat'],
  ['desert', 'Desert beat'],
  ['mountain', 'Mountain beat'],
  ['city', 'City beat'],
  ['silent', 'No sound'],
];

export function ClipBox({ clip, trackId, audio }: { clip: Clip | 'pending'; trackId: string; audio: () => AudioContext | null }) {
  const [sound, setSound] = useState<ClipSound>('game');
  const [made, setMade] = useState<ExportedClip | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // A silent looping preview of the raw clip while the player picks a sound.
  useEffect(() => {
    if (clip === 'pending') return;
    const url = URL.createObjectURL(clip.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);
  useEffect(
    () => () => {
      if (made) URL.revokeObjectURL(made.url);
    },
    [made],
  );

  if (clip === 'pending') {
    return (
      <div className="clipbox">
        <b className="display">Your highlight</b>
        <p className="small muted">Saving your best moment...</p>
      </div>
    );
  }

  const make = async () => {
    setMsg(null);
    setMade(null);
    setProgress(0);
    try {
      const out = await exportClip(clip, sound, audio(), setProgress);
      setMade(out);
      logPlay('clip_made', { sound, label: clip.label });
    } catch (e) {
      setMsg((e as Error).message || 'Could not make the clip on this browser.');
    } finally {
      setProgress(null);
    }
  };

  const text = `${clip.label === 'WIN' ? 'First across the line' : clip.label === 'KNOCKOUT' ? 'Knocked a rider clean off' : clip.label === 'BUSTED' ? 'Got busted by the cops' : 'Wild ride'} on ${trackById(trackId).name}. Play Throttle Bike free at throttlebike.com`;

  return (
    <div className="clipbox">
      <div className="clip-head">
        <b className="display">Your highlight</b>
        <span className="small muted">10 seconds, ready for Status and Stories</span>
      </div>
      <div className="clip-body">
        {/* Preview: the finished clip once made, else the raw moment. */}
        <video className="clip-video" src={made?.url ?? preview ?? undefined} autoPlay loop muted={!made} playsInline controls={!!made} />
        <div className="clip-side">
          <span className="small muted">Sound</span>
          <div className="clip-sounds" role="radiogroup" aria-label="Clip sound">
            {SOUNDS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sound === id}
                className={sound === id ? 'on' : ''}
                disabled={progress !== null}
                onClick={() => {
                  setSound(id);
                  setMade(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {progress !== null ? (
        <div className="clip-progress" role="status">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
          <span>Making your clip... {Math.ceil((1 - progress) * 10)}s</span>
        </div>
      ) : made ? (
        <div className="clip-actions">
          <button
            type="button"
            className="btn wide share"
            onClick={async () => {
              const how = await shareClip(made.file, text);
              if (how === 'saved') setMsg('Saved. Post it from your gallery to Status or your Story.');
              if (how !== 'cancelled') logPlay('clip_shared', { method: how, sound });
            }}
          >
            Share to Status / Story
          </button>
          <button
            type="button"
            className="btn alt wide"
            onClick={() => {
              saveClip(made.file);
              setMsg('Saved to your downloads.');
              logPlay('clip_shared', { method: 'saved', sound });
            }}
          >
            Save video
          </button>
        </div>
      ) : (
        <button type="button" className="btn wide share" onClick={make}>
          Make my clip
        </button>
      )}
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
