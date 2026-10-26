// Share Moments, picture. A moment is filmed again from its snapshots, one
// frame at a time at a steady 30 fps, so the clip never stutters whatever the
// phone was doing during the race. Each style is a timeline that maps output
// time to race time: normal speed, slow motion, a freeze. The picture is then
// dressed (zoom punch, flash, captions, end card) and encoded to an MP4 with
// WebCodecs. Browsers without it record the same frames in real time instead.

import type { Game } from '../engine/game';
import { Renderer } from '../engine/render';
import { replayView, snapAt, type Moment, type Snap } from '../engine/replay';
import { renderClipAudio, type AudioPlan, type ClipStyle, type SoundCue } from './clipAudio';
import { titleUrl } from './uiArt';
import { sourceAt, timeline, type Timeline } from './timeline';

export type { ClipStyle } from './clipAudio';

export const FILM_W = 720;
export const FILM_H = 1280;
export const FPS = 30;
const BITRATE = 6_000_000;
/** Seconds of the closing card. */
const CARD = 1;

/** The race a moment came from: its track survives the next race starting. */
export interface Scene {
  setup: Game['setup'];
  track: Game['track'];
  L: number;
}

export interface FilmJob {
  moment: Moment;
  scene: Scene;
  style: ClipStyle;
  /** The dare on the end card, e.g. "Beat my 1:42.3 on Harbor Run". */
  dare: string;
}

export interface Film {
  blob: Blob;
  type: string;
  ext: 'mp4' | 'webm';
}

const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

const FONT = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';

/** Draw text that shrinks to fit the width. */
function slam(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number, fill: string, stroke = '#120d26') {
  ctx.font = `italic 900 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.floor((size * maxW) / w);
    ctx.font = `italic 900 ${size}px ${FONT}`;
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.12);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** Everything a frame needs, worked out before any drawing so the sound can be made first. */
interface Shot {
  o: number;
  src: number;
  rate: number;
  snap: Snap;
  /** Hits that happen in this frame (each hit lands in exactly one frame). */
  fresh: boolean;
}

function shots(job: FilmJob, tl: Timeline) {
  const { moment, scene } = job;
  const list: Shot[] = [];
  let last: Snap['events'] | null = null;
  const n = Math.round(tl.end * FPS);
  for (let i = 0; i < n; i++) {
    const o = i / FPS;
    const { src, rate } = sourceAt(tl, o);
    const snap = snapAt(moment.snaps, moment.t + src, scene.L);
    const fresh = snap.events !== last && rate > 0;
    last = snap.events;
    list.push({ o, src, rate, snap, fresh });
  }
  return list;
}

function audioPlan(style: ClipStyle, tl: Timeline, list: Shot[]): AudioPlan {
  const cues: SoundCue[] = [];
  for (const s of list) {
    if (!s.fresh) continue;
    for (const e of s.snap.events) {
      if (e.kind === 'spark') cues.push({ t: s.o, kind: 'punch', rate: s.rate });
      else if (e.kind === 'ko' || e.kind === 'dust') cues.push({ t: s.o, kind: 'crash', rate: s.rate });
    }
  }
  // Not every punch: the clip gets one sound per tenth of a second at most.
  const kept: SoundCue[] = [];
  for (const c of cues) if (!kept.some((k) => k.kind === c.kind && Math.abs(k.t - c.t) < 0.1)) kept.push(c);
  const kmh = list.map((s) => s.snap.player.speed);
  const top = Math.max(1, ...kmh);
  return {
    style,
    total: tl.end + CARD,
    impact: tl.impact,
    end: tl.end,
    slow: tl.slow,
    freeze: tl.freeze,
    cues: kept,
    // The engine pitch reads speed as a share of the fastest moment in the clip, in km/h-ish units.
    speed: (t) => ((kmh[Math.min(kmh.length - 1, Math.max(0, Math.round(t * FPS)))] ?? 0) / top) * 220,
  };
}

/** Paints output frames: the replay underneath, the style's dressing on top. */
class Director {
  readonly out: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stage: HTMLCanvasElement;
  private renderer: Renderer;
  private prevSrc: number | null = null;
  constructor(
    private job: FilmJob,
    private tl: Timeline,
    private art: HTMLImageElement | null,
  ) {
    this.out = document.createElement('canvas');
    this.out.width = FILM_W;
    this.out.height = FILM_H;
    const ctx = this.out.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.stage = document.createElement('canvas');
    this.renderer = new Renderer(this.stage, { width: FILM_W, height: FILM_H });
    this.renderer.cinematic = true;
  }

  /** Draw output time o. */
  frame(shot: Shot | null, o: number) {
    const { tl, job } = this;
    if (shot) {
      const view = replayView(job.scene as unknown as Game, shot.snap);
      if (!shot.fresh) view.events = [];
      // A held frame keeps its hit flash forever: drop it, the clip adds its own.
      if (shot.rate === 0) view.flash = 0;
      const dt = this.prevSrc === null ? 1 / FPS : Math.max(0, shot.src - this.prevSrc);
      this.prevSrc = shot.src;
      this.renderer.render(view, Math.min(0.05, dt));
      this.race(o);
    }
    if (o >= tl.end - 0.15) this.card(o);
  }

  private race(o: number) {
    const ctx = this.ctx;
    const { style } = this.job;
    const { impact } = this.tl;
    const k = o - impact;
    const W = FILM_W;
    const H = FILM_H;
    // Zoom punch and shake on the hit.
    let zoom = 1;
    let dx = 0;
    let dy = 0;
    if (style !== 'clean' && k >= 0) {
      zoom = 1 + (style === 'hype' ? 0.16 : 0.1) * Math.exp(-k * 2.5);
      const sh = k < 0.45 ? (1 - k / 0.45) * (style === 'hype' ? 16 : 10) : 0;
      dx = (Math.random() - 0.5) * sh * 2;
      dy = (Math.random() - 0.5) * sh * 2;
    }
    if (this.tl.freeze && o >= this.tl.freeze[0] && o < this.tl.freeze[1]) zoom = 1.12 + (o - this.tl.freeze[0]) * 0.06;
    const ax = W / 2;
    const ay = H * 0.68;
    ctx.save();
    ctx.translate(ax + dx, ay + dy);
    ctx.scale(zoom, zoom);
    ctx.drawImage(this.stage, -ax, -ay);
    ctx.restore();

    // Cinema bars in slow motion and the freeze.
    const span = this.tl.slow ?? this.tl.freeze;
    if (style !== 'clean' && span) {
      const inn = ease((o - span[0] + 0.2) / 0.25) * (1 - ease((o - span[1] + 0.1) / 0.25));
      const bar = 96 * inn;
      if (bar > 0.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, bar);
        ctx.fillRect(0, H - bar, W, bar);
      }
    }
    // The freeze: colors drained, a hard white edge.
    if (this.tl.freeze && o >= this.tl.freeze[0] && o < this.tl.freeze[1]) {
      ctx.fillStyle = 'rgba(255,240,200,0.1)';
      ctx.fillRect(0, 0, W, H);
    }
    // Flash on the hit.
    if (style !== 'clean' && k >= 0 && k < 0.35) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k / 0.35)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // A shade at the top so the words always read.
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.32);
    g.addColorStop(0, 'rgba(18,13,38,0.65)');
    g.addColorStop(1, 'rgba(18,13,38,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.32);

    this.captions(o, k);
  }

  private captions(o: number, k: number) {
    const ctx = this.ctx;
    const { moment, style } = this.job;
    const W = FILM_W;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // The mark, small and steady.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'left';
    slam(ctx, 'THROTTLE BIKE', 36, 150, 34, 300, '#ffd34d');
    ctx.restore();

    if (style === 'hype') {
      if (k < 0) return;
      const s = k < 0.16 ? 2.6 - 1.6 * ease(k / 0.16) : 1;
      ctx.save();
      ctx.translate(W / 2, 300);
      ctx.rotate(-0.05);
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, k / 0.06);
      slam(ctx, moment.label, 0, 0, 118, W - 70, '#ffd34d');
      ctx.restore();
      if (k > 0.3) {
        ctx.save();
        ctx.globalAlpha = ease((k - 0.3) / 0.2);
        slam(ctx, moment.detail.toUpperCase(), W / 2, 368, 44, W - 90, '#f4f1ff');
        ctx.restore();
      }
    } else if (style === 'funny') {
      const fz = this.tl.freeze;
      if (fz && o >= fz[0] && o < fz[1] + 0.3) {
        const kk = o - fz[0];
        const s = kk < 0.12 ? 3 - 2 * ease(kk / 0.12) : 1 + Math.sin(kk * 30) * 0.02;
        ctx.save();
        ctx.translate(W / 2, 560);
        ctx.rotate(-0.12);
        ctx.scale(s, s);
        slam(ctx, 'OOF', 0, 0, 260, W - 60, '#ffffff', '#120d26');
        ctx.restore();
      }
      if (fz ? o >= fz[1] : k >= 0) {
        const kk = o - (fz ? fz[1] : this.tl.impact);
        ctx.save();
        ctx.globalAlpha = ease(kk / 0.15);
        ctx.translate(W / 2, 300);
        ctx.rotate(0.04);
        slam(ctx, moment.label, 0, 0, 96, W - 70, '#ff8a5c');
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = ease((kk - 0.2) / 0.2);
        slam(ctx, moment.detail.toUpperCase(), W / 2, 360, 40, W - 90, '#f4f1ff');
        ctx.restore();
      }
    } else if (k >= 0) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.globalAlpha = ease(k / 0.3);
      slam(ctx, moment.label, 40, FILM_H - 190, 60, W - 80, '#ffffff');
      slam(ctx, moment.detail.toUpperCase(), 40, FILM_H - 140, 32, W - 80, '#ffd34d');
      ctx.restore();
    }
  }

  /** The last second: the dare and where to play. */
  private card(o: number) {
    const ctx = this.ctx;
    const W = FILM_W;
    const H = FILM_H;
    const k = o - this.tl.end;
    ctx.save();
    ctx.globalAlpha = ease((k + 0.15) / 0.15);
    ctx.fillStyle = '#120d26';
    ctx.fillRect(0, 0, W, H);
    if (this.art) {
      ctx.globalAlpha *= 0.55;
      ctx.drawImage(this.art, 0, 0, W, H);
      ctx.globalAlpha = ease((k + 0.15) / 0.15);
    }
    const g = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.75);
    g.addColorStop(0, 'rgba(18,13,38,0.2)');
    g.addColorStop(0.5, 'rgba(18,13,38,0.85)');
    g.addColorStop(1, 'rgba(18,13,38,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const s = 1 + 0.25 * (1 - ease(k / 0.2));
    ctx.translate(W / 2, H * 0.44);
    ctx.scale(s, s);
    slam(ctx, 'THROTTLE', 0, 0, 150, W - 80, '#ffd34d', '#c2577a');
    slam(ctx, 'BIKE', 0, 130, 150, W - 80, '#ffd34d', '#c2577a');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    slam(ctx, this.job.dare.toUpperCase(), W / 2, H * 0.44 + 250, 46, W - 80, '#f4f1ff');
    slam(ctx, 'THROTTLEBIKE.COM', W / 2, H * 0.44 + 330, 54, W - 80, '#7dff9a');
    ctx.restore();
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Progress = (share: number) => void;

/** Can this browser make a clip at all? */
export function canFilm() {
  if (typeof document === 'undefined') return false;
  const c = document.createElement('canvas');
  const hasEncoder = typeof (window as { VideoEncoder?: unknown }).VideoEncoder === 'function';
  const hasRecorder = typeof MediaRecorder !== 'undefined' && typeof c.captureStream === 'function';
  return hasEncoder || hasRecorder;
}

/** Film one moment in one style. */
export async function makeFilm(job: FilmJob, onProgress: Progress = () => {}, signal?: AbortSignal): Promise<Film> {
  const snaps = job.moment.snaps;
  const have: [number, number] = [(snaps[0]?.clock ?? job.moment.t) - job.moment.t, (snaps.at(-1)?.clock ?? job.moment.t) - job.moment.t];
  const tl = timeline(job.style, have);
  const list = shots(job, tl);
  try {
    await document.fonts?.load(`italic 900 40px ${FONT}`);
  } catch {
    /* system font then */
  }
  const art = await loadImage(titleUrl('tall'));
  const plan = audioPlan(job.style, tl, list);
  const audio = await renderClipAudio(plan);
  onProgress(0.08);
  const director = new Director(job, tl, art);
  const total = Math.round(plan.total * FPS);
  const at = (i: number) => (i < list.length ? (list[i] ?? null) : null);

  const mb = await import('mediabunny');
  // H.264 always; AAC where the browser has it (Chrome on phones, Safari), else Opus.
  const avc = await mb.canEncodeVideo('avc', { width: FILM_W, height: FILM_H, bitrate: BITRATE });
  const aac = avc && (await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: audio.sampleRate }));
  const opus = avc && !aac && (await mb.canEncodeAudio('opus', { numberOfChannels: 2, sampleRate: audio.sampleRate }));
  if (aac || opus) {
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const video = new mb.CanvasSource(director.out, { codec: 'avc', bitrate: BITRATE, keyFrameInterval: 2 });
    const sound = new mb.AudioBufferSource({ codec: aac ? 'aac' : 'opus', bitrate: 160_000 });
    output.addVideoTrack(video, { frameRate: FPS });
    output.addAudioTrack(sound);
    await output.start();
    // Sound first: the muxer interleaves tracks, so frames wait for audio that would only come at the end.
    await sound.add(audio);
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) {
        await output.cancel();
        throw new DOMException('Cancelled', 'AbortError');
      }
      director.frame(at(i), i / FPS);
      await video.add(i / FPS, 1 / FPS);
      onProgress(0.08 + (0.88 * (i + 1)) / total);
      if (i % 4 === 3) await tick();
    }
    await output.finalize();
    onProgress(1);
    const buf = target.buffer;
    if (!buf) throw new Error('No video was written');
    return { blob: new Blob([buf], { type: 'video/mp4' }), type: 'video/mp4', ext: 'mp4' };
  }
  return recordRealtime(director, total, at, audio, onProgress, signal);
}

/** Fallback: play the frames and the sound in real time into a MediaRecorder. */
async function recordRealtime(director: Director, total: number, at: (i: number) => Shot | null, audio: AudioBuffer, onProgress: Progress, signal?: AbortSignal): Promise<Film> {
  const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const type = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const stream = director.out.captureStream(FPS);
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  try {
    await ac.resume();
  } catch {
    /* silent clip then */
  }
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = audio;
  src.connect(dest);
  for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
  const rec = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  director.frame(at(0), 0);
  rec.start(250);
  src.start();
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break;
    director.frame(at(i), i / FPS);
    onProgress(0.08 + (0.9 * (i + 1)) / total);
    const wait = t0 + ((i + 1) * 1000) / FPS - performance.now();
    await new Promise((r) => setTimeout(r, Math.max(0, wait)));
  }
  rec.stop();
  await stopped;
  try {
    src.stop();
  } catch {
    /* already ended */
  }
  void ac.close();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  onProgress(1);
  const mime = rec.mimeType || type || 'video/webm';
  return { blob: new Blob(chunks, { type: mime }), type: mime, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
