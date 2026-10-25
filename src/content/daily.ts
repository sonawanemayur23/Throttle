// Daily race (P3-05): one track and level for the whole world each day,
// picked from the UTC date, so everyone races the same thing with no server.
// It changes at 00:00 UTC (05:30 in India).

import { TRACKS } from './tracks';

export interface DailyRace {
  /** UTC date, YYYY-MM-DD. Saved with results, used in share text. */
  key: string;
  trackId: string;
  /** Levels 1 to 3, so new players can take part. */
  level: number;
  /** Cash for the first finish of the day, paid once. */
  bonus: number;
  /** Milliseconds until the next daily. */
  resetsIn: number;
}

/** FNV-1a: a small, stable hash so the pick never depends on the browser. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A shuffle of 0..n-1 that depends only on the block number. */
function blockOrder(block: number, n: number) {
  const order = Array.from({ length: n }, (_, i) => i);
  let h = hash(`throttle-block-${block}`);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const dailyKey = (now: Date) => now.toISOString().slice(0, 10);

export function dailyFor(now: Date = new Date()): DailyRace {
  const key = dailyKey(now);
  const h = hash(`throttle-daily-${key}`);
  // Every block of 4 days plays each track once, in a shuffled order, and a
  // block never starts with the track the last one ended on.
  const day = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const n = TRACKS.length;
  const block = Math.floor(day / n);
  const order = blockOrder(block, n);
  const before = blockOrder(block - 1, n);
  if (order[0] === before[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  const trackId = TRACKS[order[day % n]].id;
  const level = 1 + ((h >>> 4) % 3);
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return { key, trackId, level, bonus: 500 * level, resetsIn: next - now.getTime() };
}

/** The day before `key` (YYYY-MM-DD), for streaks. */
export function dayBefore(key: string) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dailyKey(d);
}

/** "5h 12m" until the next daily. */
export function untilReset(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}
