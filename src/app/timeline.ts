// Share Moments, timing. Each style is a timeline that maps clip time to race
// time: normal speed, slow motion, a freeze. Pure, so it runs in Node tests.

import type { ClipStyle } from './clipAudio';

/** A piece of a timeline: race seconds a..b (relative to the hit) played over d output seconds. a === b is a freeze. */
export interface Seg {
  a: number;
  b: number;
  d: number;
}

export const TIMELINES: Record<ClipStyle, Seg[]> = {
  // Build up at full speed, slow motion through the hit, a beat of aftermath.
  hype: [
    { a: -5, b: -0.25, d: 4.75 },
    { a: -0.25, b: 0.95, d: 3.25 },
    { a: 0.95, b: 1.95, d: 1 },
  ],
  // Run up to the hit, freeze on it, then watch it slowly go wrong.
  funny: [
    { a: -4.9, b: 0, d: 4.9 },
    { a: 0, b: 0, d: 0.8 },
    { a: 0, b: 1.2, d: 2.4 },
    { a: 1.2, b: 2.1, d: 0.9 },
  ],
  // Just the race.
  clean: [{ a: -6, b: 3, d: 9 }],
};

export interface Timeline {
  segs: Seg[];
  /** Output seconds before the end card. */
  end: number;
  impact: number;
  slow: [number, number] | null;
  freeze: [number, number] | null;
}

/** The style's timeline, cut to the race the moment actually holds (early hits have less build up). */
export function timeline(style: ClipStyle, have: [number, number]): Timeline {
  const segs: Seg[] = [];
  for (const s of TIMELINES[style]) {
    if (s.a === s.b) {
      if (s.a >= have[0] && s.a <= have[1]) segs.push({ ...s });
      continue;
    }
    const a = Math.max(s.a, have[0]);
    const b = Math.min(s.b, have[1]);
    if (b - a < 0.05) continue;
    segs.push({ a, b, d: (s.d * (b - a)) / (s.b - s.a) });
  }
  let o = 0;
  let impact = -1;
  let slow: [number, number] | null = null;
  let freeze: [number, number] | null = null;
  for (const s of segs) {
    if (impact < 0 && s.a <= 0 && s.b >= 0) impact = o + (s.b > s.a ? ((0 - s.a) / (s.b - s.a)) * s.d : 0);
    const rate = (s.b - s.a) / s.d;
    if (rate === 0) freeze = [o, o + s.d];
    else if (rate < 0.9) slow = [o, o + s.d];
    o += s.d;
  }
  return { segs, end: o, impact: Math.max(0, impact), slow, freeze };
}

/** Race seconds (relative to the hit) and playback speed at output time o. */
export function sourceAt(tl: Timeline, o: number): { src: number; rate: number } {
  let t0 = 0;
  for (const s of tl.segs) {
    if (o < t0 + s.d) return { src: s.a + ((s.b - s.a) * (o - t0)) / s.d, rate: (s.b - s.a) / s.d };
    t0 += s.d;
  }
  const last = tl.segs.at(-1);
  return { src: last ? last.b : 0, rate: 1 };
}

