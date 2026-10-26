// Turns a raw highlight into the 10 second video the player shares: trimmed
// around the moment, with the sound they picked (the race's own sound, one of
// the game's music loops, or silence). It plays the raw clip once in real time
// and records it again, so it takes about 10 seconds. Nothing leaves the phone.

import { MusicBed, type MusicId } from '../engine/music';
import { CLIP_H, CLIP_W, clipType, type Clip } from './clip';

export const CLIP_SECONDS = 10;
export type ClipSound = 'game' | 'silent' | MusicId;

export interface ExportedClip {
  file: File;
  url: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function exportClip(clip: Clip, sound: ClipSound, actx: AudioContext | null, onProgress?: (done: number) => void): Promise<ExportedClip> {
  const type = clipType() ?? clip.type;
  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.src = URL.createObjectURL(clip.blob);
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('This browser could not read the clip.'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = CLIP_W;
  canvas.height = CLIP_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  const tracks = [...canvas.captureStream(30).getVideoTracks()];

  // Sound: route it into a stream for the recorder, never to the speakers.
  let bed: MusicBed | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  if (actx && sound !== 'silent' && typeof actx.createMediaStreamDestination === 'function') {
    if (actx.state !== 'running') await actx.resume().catch(() => undefined);
    const dest = actx.createMediaStreamDestination();
    if (sound === 'game') {
      source = actx.createMediaElementSource(video);
      source.connect(dest);
    } else {
      bed = new MusicBed();
      bed.setVolume(0.9);
      bed.attach(actx, dest);
      bed.play(sound, true);
    }
    tracks.push(...dest.stream.getAudioTracks());
  }
  video.muted = sound !== 'game';

  // Jump to the moment when the browser can seek in the file; otherwise play through to it.
  const from = clip.offset;
  try {
    video.currentTime = from;
    await Promise.race([new Promise((r) => (video.onseeked = r)), wait(800)]);
  } catch {
    /* play from the start instead */
  }
  const startAt = video.currentTime > from - 0.5 ? video.currentTime : from;

  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 3_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  try {
    await video.play();
  } catch {
    // Some phones only play muted outside the tap; the game sound is lost then, the picture is not.
    video.muted = true;
    await video.play();
  }
  let recording = false;
  let began = 0;
  await new Promise<void>((resolve) => {
    const step = () => {
      const t = video.currentTime;
      if (!recording && t >= startAt - 0.05) {
        recording = true;
        began = performance.now();
        rec.start(250);
        bed?.play((sound as MusicId) ?? 'menu', true);
      }
      ctx.drawImage(video, 0, 0, CLIP_W, CLIP_H);
      const got = recording ? (performance.now() - began) / 1000 : 0;
      onProgress?.(Math.min(1, got / CLIP_SECONDS));
      if (recording && (got >= CLIP_SECONDS || video.ended)) return resolve();
      if (!recording && video.ended) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  if (rec.state === 'recording') rec.stop();
  await stopped;
  video.pause();
  bed?.detach();
  source?.disconnect();
  URL.revokeObjectURL(video.src);
  tracks.forEach((t) => t.stop());

  const mime = type.split(';')[0];
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime });
  const file = new File([blob], `throttle-bike-${Date.now()}.${ext}`, { type: mime });
  return { file, url: URL.createObjectURL(blob) };
}

/** Share the video through the phone's share sheet (WhatsApp Status, Instagram Story...), or save it. */
export async function shareClip(file: File, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  saveClip(file);
  return 'saved';
}

export function saveClip(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
