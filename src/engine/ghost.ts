// Ghost races (P3-01). Every race records the player's position along the road
// (d) and across it (x) a few times a second. A finished race can be packed
// into a short string for a "beat my time" link, and a challenger then races
// against that recording as a see-through ghost rider.
//
// Packed format, version 1, then base64url:
//   [1]           version
//   [1]           track index (TRACK_IDS)
//   [1]           career level
//   [1]           bike index (BIKE_IDS)
//   [4]           finish time, ms, big-endian
//   [1]           place
//   [1] [n]       name length, then UTF-8 name (at most 16 bytes)
//   [2]           sample count, big-endian
//   [n x 2]       per sample: forward step in D_UNIT units (0..255), x * X_SCALE (int8)
// Steps come from rounded running totals, so rounding never drifts.

export const GHOST_STEP = 0.25; // seconds between samples
const D_UNIT = 50; // world units per step unit; 12,000 a second fits in 60
const X_SCALE = 50; // x in -2.5..2.5 fits in int8
const MAX_SAMPLES = 2400; // 10 minutes
const VERSION = 1;

export const TRACK_IDS = ['coast', 'desert', 'mountain', 'city'];
export const BIKE_IDS = ['sparrow', 'kestrel', 'bison', 'shrike', 'nightjar'];

export interface Ghost {
  trackId: string;
  level: number;
  bikeId: string;
  /** Finish time in seconds. */
  time: number;
  place: number;
  name: string;
  /** Positions every GHOST_STEP seconds from the start. */
  d: number[];
  x: number[];
}

/** Collects samples during a race. */
export class GhostRecorder {
  d: number[] = [];
  x: number[] = [];
  private next = 0;

  reset() {
    this.d = [];
    this.x = [];
    this.next = 0;
  }

  /** Call every update with race time; it keeps one sample per GHOST_STEP. */
  sample(t: number, d: number, x: number) {
    while (t >= this.next && this.d.length < MAX_SAMPLES) {
      this.d.push(d);
      this.x.push(x);
      this.next += GHOST_STEP;
    }
  }
}

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (str: string) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export function encodeGhost(g: Ghost): string {
  const name = new TextEncoder().encode(g.name.trim()).slice(0, 16);
  const n = Math.min(g.d.length, MAX_SAMPLES);
  const bytes = new Uint8Array(12 + name.length + 2 + n * 2);
  let o = 0;
  const ms = Math.max(0, Math.min(0xffffffff, Math.round(g.time * 1000)));
  bytes[o++] = VERSION;
  bytes[o++] = Math.max(0, TRACK_IDS.indexOf(g.trackId));
  bytes[o++] = g.level;
  bytes[o++] = Math.max(0, BIKE_IDS.indexOf(g.bikeId));
  bytes[o++] = (ms >>> 24) & 255;
  bytes[o++] = (ms >>> 16) & 255;
  bytes[o++] = (ms >>> 8) & 255;
  bytes[o++] = ms & 255;
  bytes[o++] = g.place;
  bytes[o++] = name.length;
  bytes.set(name, o);
  o += name.length;
  bytes[o++] = (n >> 8) & 255;
  bytes[o++] = n & 255;
  // The first step is the start position itself (usually 0, so it fits).
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const q = Math.round(g.d[i] / D_UNIT);
    const step = Math.max(0, Math.min(255, q - prev));
    prev += step;
    bytes[o++] = step;
    bytes[o++] = Math.max(-127, Math.min(127, Math.round(g.x[i] * X_SCALE))) & 255;
  }
  return b64(bytes);
}

/** Unpack a challenge string. Returns null for anything broken or unknown. */
export function decodeGhost(code: string): Ghost | null {
  try {
    const b = unb64(code);
    let o = 0;
    if (b[o++] !== VERSION) return null;
    const trackId = TRACK_IDS[b[o++]];
    const level = b[o++];
    const bikeId = BIKE_IDS[b[o++]];
    const ms = ((b[o++] << 24) >>> 0) + (b[o++] << 16) + (b[o++] << 8) + b[o++];
    const place = b[o++];
    const nl = b[o++];
    const name = new TextDecoder().decode(b.slice(o, o + nl));
    o += nl;
    const n = (b[o++] << 8) + b[o++];
    if (!trackId || !bikeId || level < 1 || level > 9 || n < 2 || o + n * 2 > b.length) return null;
    const d: number[] = [];
    const x: number[] = [];
    let q = 0;
    for (let i = 0; i < n; i++) {
      q += b[o++];
      const xi = b[o++];
      d.push(q * D_UNIT);
      x.push((xi > 127 ? xi - 256 : xi) / X_SCALE);
    }
    return { trackId, level, bikeId, time: ms / 1000, place, name, d, x };
  } catch {
    return null;
  }
}

/** Where the ghost is at race time t. After its last sample it keeps rolling forward. */
export function ghostAt(g: Ghost, t: number) {
  const f = Math.max(0, t / GHOST_STEP);
  const i = Math.floor(f);
  const n = g.d.length;
  if (i >= n - 1) {
    const v = (g.d[n - 1] - g.d[n - 2]) / GHOST_STEP;
    return { d: g.d[n - 1] + v * (t - (n - 1) * GHOST_STEP), x: g.x[n - 1] };
  }
  const k = f - i;
  return { d: g.d[i] + (g.d[i + 1] - g.d[i]) * k, x: g.x[i] + (g.x[i + 1] - g.x[i]) * k };
}

/**
 * Seconds the player is behind the ghost (negative: ahead), comparing when
 * the ghost passed the player's spot with the race clock now.
 */
export function ghostGap(g: Ghost, d: number, t: number) {
  const n = g.d.length;
  if (d >= g.d[n - 1]) return t - g.time;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.d[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = g.d[hi] - g.d[lo] || 1;
  const tg = (lo + (d - g.d[lo]) / span) * GHOST_STEP;
  return t - tg;
}
