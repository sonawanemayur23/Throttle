// Share Moments, part 1: remember the race well enough to film it again.
//
// Every update the game state is copied into a snapshot (a few hundred plain
// numbers). The last few seconds sit in a ring buffer. When something worth
// sharing happens (a takedown, a wipeout, a photo finish...), the buffer is
// kept and the next few seconds are added, so each moment has the build up and
// the aftermath. After the race the clip is drawn again from these snapshots,
// frame by frame, which is why it never stutters and can go into slow motion.
//
// No DOM here: the engine layer runs in Node tests.

import type { Car, Cop, Game, Player, Rival } from './game';
import { KMH_AT_MAX, MAX_SPEED } from './config';

/** Seconds kept before a moment and after it. */
export const PRE = 7;
export const POST = 4;
/** At most this many moments are offered after a race. */
export const MAX_MOMENTS = 3;

export type MomentKind = 'takedown' | 'copdown' | 'wipeout' | 'photo' | 'win' | 'busted' | 'traffic' | 'lead';

/** One frame of the race, enough for the renderer to draw it again. */
export interface Snap {
  t: number; // race time
  clock: number;
  phase: Game['phase'];
  player: Player;
  rivals: Rival[];
  cop: Cop;
  cars: Car[];
  combo: number;
  comboT: number;
  score: number;
  shake: number;
  flash: number;
  flashColor: string;
  /** Hits and sparks this frame. `who`: -1 player, -2 cop, else rival index. */
  events: Array<{ kind: Game['events'][number]['kind']; who: number; side: number }>;
}

export interface Moment {
  kind: MomentKind;
  /** Big caption, e.g. TAKEDOWN. */
  label: string;
  /** Small line, e.g. "Vex at 204 km/h". */
  detail: string;
  /** Higher is more worth sharing. */
  score: number;
  /** Game clock at the hit, the instant the clip is built around. The clock keeps
   * running after the finish line, unlike race time, so it orders every snapshot. */
  t: number;
  snaps: Snap[];
}

const copy = <T extends object>(o: T): T => ({ ...o });

export function takeSnap(g: Game): Snap {
  const who = (at: unknown) => (at === g.player ? -1 : at === g.cop ? -2 : g.rivals.indexOf(at as Rival));
  return {
    t: g.raceTime,
    clock: g.clock,
    phase: g.phase,
    player: copy(g.player),
    rivals: g.rivals.map(copy),
    cop: copy(g.cop),
    cars: g.cars.map(copy),
    combo: g.combo,
    comboT: g.comboT,
    score: g.score,
    shake: g.shake,
    flash: g.flash,
    flashColor: g.flashColor,
    events: g.events.map((e) => ({ kind: e.kind, who: who(e.at), side: e.side })),
  };
}

const kmh = (speed: number) => Math.round((speed / MAX_SPEED) * KMH_AT_MAX);

/** How much each kind of moment is worth sharing. From the Share Moments plan; tuned by real share data later. */
const WORTH: Record<MomentKind, number> = {
  photo: 9,
  copdown: 8,
  wipeout: 7,
  takedown: 6,
  win: 5,
  busted: 5,
  lead: 4,
  traffic: 3,
};

interface Capture {
  m: Moment;
  until: number;
}

/**
 * Watches a race and keeps its best moments. Call `observe` after every game
 * update and `finish` when the results are in.
 */
export class MomentTracker {
  private ring: Snap[] = [];
  private open: Capture[] = [];
  private done: Moment[] = [];
  private place = 7;
  private misses: number[] = [];
  private lastMisses = 0;

  reset() {
    this.ring = [];
    this.open = [];
    this.done = [];
    this.place = 7;
    this.misses = [];
    this.lastMisses = 0;
  }

  observe(g: Game) {
    if (g.phase !== 'race' && g.phase !== 'finished') return;
    if (g.phase === 'finished' && !this.open.length) return;
    const s = takeSnap(g);
    this.ring.push(s);
    while (this.ring.length && s.clock - this.ring[0].clock > PRE) this.ring.shift();
    for (const c of this.open) c.m.snaps.push(s);
    // Close captures that have their aftermath.
    this.open = this.open.filter((c) => {
      const end = s.clock >= c.until;
      if (end) this.done.push(c.m);
      return !end;
    });
    if (g.phase !== 'race') return;

    for (const e of s.events) {
      if (e.kind !== 'ko' && e.kind !== 'dust') continue;
      if (e.kind === 'dust') {
        this.spot(g, 'wipeout', 'WIPEOUT', `at ${kmh(s.player.speed) || kmh(this.ring.at(-2)?.player.speed ?? 0)} km/h`, 0);
      } else if (e.who === -2) {
        this.spot(g, 'copdown', 'COP DOWN', 'Knocked off the police bike', 0);
      } else if (e.who >= 0) {
        const r = s.rivals.at(e.who);
        const chain = g.combo >= 3 ? `, combo x${g.combo}` : '';
        this.spot(g, 'takedown', g.combo >= 3 ? 'COMBO TAKEDOWN' : 'TAKEDOWN', `${r?.name ?? 'Rival'} down${chain}`, Math.min(g.combo, 6));
      }
    }
    // Threading traffic: 3 near misses inside 4 seconds.
    if (g.nearMisses > this.lastMisses) {
      for (let i = this.lastMisses; i < g.nearMisses; i++) this.misses.push(s.t);
      this.lastMisses = g.nearMisses;
      this.misses = this.misses.filter((t) => s.t - t < 4);
      if (this.misses.length >= 3) {
        this.spot(g, 'traffic', 'THREADING TRAFFIC', `${this.misses.length} near misses`, this.misses.length - 3);
        this.misses = [];
      }
    }
    // Taking the lead.
    const place = g.place();
    if (place === 1 && this.place > 1 && s.t > 8) this.spot(g, 'lead', 'TAKES THE LEAD', `at ${kmh(s.player.speed)} km/h`, 0);
    this.place = place;
  }

  /** The race just ended: add the finish moment. */
  finished(g: Game) {
    const r = g.results;
    if (!r) return;
    if (r.busted) {
      this.spot(g, 'busted', 'BUSTED', 'Caught by the police', 0);
      return;
    }
    // Closest rival at the line, in seconds.
    const p = g.player;
    let gap = Infinity;
    for (const v of g.rivals) if (!v.down && v.speed > 0) gap = Math.min(gap, Math.abs(p.d - v.d) / Math.max(v.speed, p.speed, 1));
    if (gap < 0.5) this.spot(g, 'photo', 'PHOTO FINISH', `${r.place === 1 ? 'Won' : `${r.place}th`} by ${gap.toFixed(2)}s`, 0);
    else if (r.place === 1) this.spot(g, 'win', 'FIRST PLACE', `${(r.time / 60) | 0}:${(r.time % 60).toFixed(1).padStart(4, '0')} on the clock`, 0);
  }

  private spot(g: Game, kind: MomentKind, label: string, detail: string, bonus: number) {
    const t = g.clock;
    const score = WORTH[kind] + bonus;
    // One moment per few seconds: a bigger moment replaces a smaller one close by.
    const near = [...this.open, ...this.done.map((m) => ({ m, until: 0 }))].find((c) => Math.abs(c.m.t - t) < 3);
    if (near) {
      if (near.m.score >= score) return;
      Object.assign(near.m, { kind, label, detail, score, t });
      // Still filming: keep the aftermath of the bigger moment too.
      if (near.until > 0) near.until = Math.max(near.until, t + POST);
      return;
    }
    const m: Moment = { kind, label, detail, score, t, snaps: [...this.ring] };
    this.open.push({ m, until: t + POST });
  }

  /** True while a moment still waits for its aftermath. */
  get filming() {
    return this.open.length > 0;
  }

  /** The best moments of the race, best first. */
  finish(): Moment[] {
    this.done.push(...this.open.map((c) => c.m));
    this.open = [];
    const best = this.done
      .filter((m) => m.snaps.length > 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MOMENTS);
    this.done = [];
    this.ring = [];
    return best;
  }
}

// ---------------------------------------------------------------------------
// Playing a moment back.

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Blend two copies of the same object: numbers in between, everything else from the nearer one. */
function blend<T extends object>(a: T, b: T, f: number): T {
  const out = { ...a } as Record<string, unknown>;
  const bb = b as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    const va = out[k];
    const vb = bb[k];
    if (typeof va === 'number' && typeof vb === 'number') out[k] = lerp(va, vb, f);
    else if (f > 0.5) out[k] = vb;
  }
  return out as T;
}

/** The race as it was at game clock `t`, blended between the two nearest snapshots. */
export function snapAt(snaps: Snap[], t: number, L: number): Snap {
  let i = 0;
  while (i < snaps.length - 2 && snaps[i + 1].clock <= t) i++;
  const a = snaps[i];
  const b = snaps[Math.min(i + 1, snaps.length - 1)];
  const span = b.clock - a.clock;
  const f = span > 0 ? Math.max(0, Math.min(1, (t - a.clock) / span)) : 0;
  if (f === 0 || a === b) return a;
  return {
    ...blend(a, b, f),
    player: blend(a.player, b.player, f),
    rivals: a.rivals.map((r, k) => blend(r, b.rivals[k] ?? r, f)),
    cop: blend(a.cop, b.cop, f),
    // Traffic wraps around the loop: blend along the short way.
    cars: a.cars.map((c, k) => {
      const nb = b.cars[k] ?? c;
      let dz = nb.z - c.z;
      if (dz > L / 2) dz -= L;
      if (dz < -L / 2) dz += L;
      return { ...blend(c, nb, f), z: (((c.z + dz * f) % L) + L) % L };
    }),
    events: f < 0.5 ? a.events : b.events,
    phase: f < 0.5 ? a.phase : b.phase,
  };
}

/**
 * A stand-in for the Game that the renderer can draw: the real track and setup,
 * with riders and traffic from a snapshot. Only what the renderer reads.
 */
export function replayView(g: Game, s: Snap) {
  const player = s.player;
  const rivals = s.rivals;
  const cop = s.cop;
  const pick = (who: number) => (who === -1 ? player : who === -2 ? cop : rivals[who]);
  const view = {
    setup: g.setup,
    track: g.track,
    L: g.L,
    phase: s.phase === 'finished' ? 'finished' : 'race',
    raceTime: s.t,
    clock: s.clock,
    countdown: 0,
    player,
    rivals,
    cop,
    cars: s.cars,
    combo: s.combo,
    comboT: s.comboT,
    score: s.score,
    shake: s.shake,
    flash: s.flash,
    flashColor: s.flashColor,
    popups: [],
    hint: null,
    ghost: null,
    reduceMotion: false,
    results: null,
    events: s.events.map((e) => ({ kind: e.kind, at: pick(e.who) ?? player, side: e.side })),
    kmh: () => kmh(player.speed),
    place: () => 1 + rivals.filter((r) => r.d > player.d).length,
  };
  return view as unknown as Game;
}
