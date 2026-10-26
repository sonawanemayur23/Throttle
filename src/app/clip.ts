// Highlight clips (P3-03). While a race runs, the game keeps recording so it
// can hand the player a 10 second video of their best moment: a knockout, a
// crash, a bust or the finish. Nothing is uploaded; the video stays on the
// phone until the player shares or saves it.
//
// How it keeps 5 seconds from before a moment without storing every frame:
// two recorders run on the same stream, each restarted every 12 seconds, and
// staggered by 6. When a moment happens, the recorder that started at least 5
// seconds earlier is kept and stopped 4 seconds later. Its file is 9 to 16
// seconds long; the exporter trims the 10 seconds around the moment.

export const CLIP_W = 540;
export const CLIP_H = 960;
const SEGMENT = 12; // seconds a recorder runs before it starts over
const PRE = 5; // seconds kept before the moment
const POST = 4; // seconds kept after it
const FPS = 30;

export interface Clip {
  blob: Blob;
  type: string;
  /** Seconds into the file where the 10 second highlight starts. */
  offset: number;
  /** What happened, for the share text. */
  label: string;
}

interface Slot {
  rec: MediaRecorder;
  chunks: Blob[];
  start: number;
  stopAt: number | null;
  label: string;
  offset: number;
  score: number;
}

/** The first video type this browser can record. MP4 first: WhatsApp and Instagram take it everywhere. */
export function clipType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

export function clipsSupported() {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  return !!(c && typeof c.captureStream === 'function' && clipType());
}

export class ClipRecorder {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d');
  private stream: MediaStream | null = null;
  private slots: Slot[] = [];
  private type = clipType() ?? '';
  private best = 0;
  private kept: Clip | null = null;
  private keptScore = 0;
  private running = false;
  private pending: Promise<void>[] = [];

  constructor() {
    this.canvas.width = CLIP_W;
    this.canvas.height = CLIP_H;
  }

  get active() {
    return this.running;
  }

  /** Start recording a race. `audio` is the game's own sound, if there is any. */
  begin(now: number, audio: MediaStream | null) {
    this.stopAll(false);
    this.kept = null;
    this.keptScore = 0;
    this.best = 0;
    this.pending = [];
    try {
      const video = this.canvas.captureStream(FPS);
      const tracks = [...video.getVideoTracks(), ...(audio?.getAudioTracks() ?? [])];
      this.stream = new MediaStream(tracks);
      this.slots = [];
      this.slots.push(this.open(now));
      // The second recorder starts half a segment later.
      this.slots.push(this.open(now + SEGMENT / 2, true));
      this.running = true;
    } catch {
      this.running = false;
    }
  }

  private open(start: number, delayed = false): Slot {
    const rec = new MediaRecorder(this.stream as MediaStream, { mimeType: this.type, videoBitsPerSecond: 2_500_000 });
    const slot: Slot = { rec, chunks: [], start, stopAt: null, label: '', offset: 0, score: 0 };
    rec.ondataavailable = (e) => e.data.size && slot.chunks.push(e.data);
    if (!delayed) rec.start(500);
    return slot;
  }

  /** Copy the game frame into the portrait clip canvas, and keep the recorders turning over. */
  frame(src: HTMLCanvasElement, now: number) {
    if (!this.running || !this.ctx) return;
    const ctx = this.ctx;
    // Phones held upright are taller than 9:16: show the whole screen (HUD
    // included) with thin side bars. Wide screens: fill the frame with the
    // middle of the view, which is where the rider is.
    const portrait = src.width / src.height < 0.7;
    const k = portrait ? Math.min(CLIP_W / src.width, CLIP_H / src.height) : Math.max(CLIP_W / src.width, CLIP_H / src.height);
    const w = src.width * k;
    const h = src.height * k;
    if (portrait) {
      ctx.fillStyle = '#120d26';
      ctx.fillRect(0, 0, CLIP_W, CLIP_H);
    }
    ctx.drawImage(src, (CLIP_W - w) / 2, (CLIP_H - h) / 2, w, h);
    // Where to play, on every clip that gets shared.
    ctx.fillStyle = 'rgba(18,13,38,0.72)';
    ctx.fillRect(0, CLIP_H - 52, CLIP_W, 52);
    ctx.fillStyle = '#ffd34d';
    ctx.font = '800 26px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('THROTTLEBIKE.COM', CLIP_W / 2, CLIP_H - 26);

    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.rec.state === 'inactive' && s.stopAt === null && now >= s.start) {
        // The delayed recorder's first start.
        s.start = now;
        s.rec.start(500);
        continue;
      }
      if (s.stopAt !== null && now >= s.stopAt) {
        this.keep(i, now);
        continue;
      }
      if (s.stopAt === null && s.rec.state === 'recording' && now - s.start >= SEGMENT) {
        // Nothing worth keeping in this one: start over.
        s.rec.onstop = null;
        s.rec.stop();
        this.slots[i] = this.open(now);
      }
    }
  }

  /** A moment worth sharing. Higher `score` wins; the clip keeps the best one. */
  highlight(score: number, label: string, now: number) {
    if (!this.running || score <= this.best) return;
    // Prefer a recorder that has PRE seconds already; else the longest running.
    const ready = this.slots
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.rec.state === 'recording')
      .sort((a, b) => a.s.start - b.s.start);
    if (!ready.length) return;
    const withPre = ready.filter(({ s }) => now - s.start >= PRE);
    const pick = (withPre.length ? withPre[withPre.length - 1] : ready[0]).s;
    this.best = score;
    pick.score = score;
    pick.label = label;
    pick.offset = Math.max(0, now - pick.start - PRE);
    pick.stopAt = now + POST;
  }

  private keep(i: number, now: number) {
    const s = this.slots[i];
    const done = new Promise<void>((resolve) => {
      s.rec.onstop = () => {
        if (s.chunks.length && s.score >= this.keptScore) {
          this.kept = { blob: new Blob(s.chunks, { type: this.type.split(';')[0] }), type: this.type, offset: s.offset, label: s.label };
          this.keptScore = s.score;
        }
        resolve();
      };
    });
    this.pending.push(done);
    s.rec.stop();
    this.slots[i] = this.open(now);
  }

  /** Stop and hand back the best clip of the race, or null if there was none. */
  async end(): Promise<Clip | null> {
    if (!this.running) return null;
    this.stopAll(true);
    this.running = false;
    await Promise.all(this.pending);
    this.stream?.getVideoTracks().forEach((t) => t.stop());
    this.stream = null;
    return this.kept;
  }

  /** Stop every recorder. `keepMarked`: recorders waiting on a moment save what they have. */
  private stopAll(keepMarked: boolean) {
    this.slots.forEach((s, i) => {
      if (keepMarked && s.stopAt !== null && s.rec.state === 'recording') {
        this.keep(i, 0);
        this.slots[i].rec.onstop = null;
      }
    });
    // What is left is fresh or unmarked: drop it.
    for (const s of this.slots) {
      if (s.rec.state !== 'inactive') {
        s.rec.onstop = null;
        try {
          s.rec.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.slots = [];
  }
}
