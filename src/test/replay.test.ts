import { describe, expect, it } from 'vitest';
import { BIKES, bikeStats, STOCK } from '../content/bikes';
import { levelDef } from '../content/career';
import { TRACKS } from '../content/tracks';
import { Game, type RaceSetup } from '../engine/game';
import { MAX_MOMENTS, MomentTracker, POST, PRE, replayView, snapAt, takeSnap, type Snap } from '../engine/replay';
import { sourceAt, timeline } from '../app/timeline';
import { FakeInput, silentSound } from './stubs';

function setup(): RaceSetup {
  return { track: TRACKS[0], bike: bikeStats(BIKES[0], STOCK), level: levelDef(3), tutorial: false };
}

/** Race a punching bot to the line with the tracker watching, like the host does. */
function filmedRace() {
  const input = new FakeInput();
  const g = new Game(silentSound(), input.asInput(), setup());
  const tracker = new MomentTracker();
  g.start(g.setup);
  tracker.reset();
  const dt = 1 / 60;
  let frames = 0;
  for (let i = 0; i < 260 * 60; i++) {
    const was = g.phase;
    const seg = g.track.find(g.player.d);
    const want = seg.curve * 0.04;
    input.steer = g.player.x > want + 0.04 ? -1 : g.player.x < want - 0.04 ? 1 : 0;
    if (i % 10 === 0) input.press('punch');
    g.update(dt);
    if (g.phase === 'finished' && was !== 'finished') tracker.finished(g);
    tracker.observe(g);
    // The renderer clears each frame's hit events.
    g.events.length = 0;
    if (g.phase === 'finished') frames++;
    if (g.phase === 'finished' && !tracker.filming) break;
  }
  return { g, tracker, frames, moments: tracker.finish() };
}

describe('Share Moments replay', () => {
  const run = filmedRace();

  it('keeps the best few moments of a race, best first', () => {
    expect(run.g.phase).toBe('finished');
    expect(run.moments.length).toBeGreaterThan(0);
    expect(run.moments.length).toBeLessThanOrEqual(MAX_MOMENTS);
    for (let i = 1; i < run.moments.length; i++) expect(run.moments[i - 1].score).toBeGreaterThanOrEqual(run.moments[i].score);
  });

  it('films the build up and the aftermath of each moment', () => {
    for (const m of run.moments) {
      const first = m.snaps[0].clock;
      const last = m.snaps.at(-1)?.clock ?? 0;
      expect(first).toBeLessThanOrEqual(m.t);
      expect(m.t - first).toBeLessThanOrEqual(PRE + 0.05);
      // The aftermath is there unless the race ended first.
      expect(last).toBeGreaterThan(m.t);
      expect(last - m.t).toBeLessThanOrEqual(POST + 3.1);
      for (let i = 1; i < m.snaps.length; i++) expect(m.snaps[i].clock).toBeGreaterThan(m.snaps[i - 1].clock);
    }
  });

  it('waits for the aftermath after the finish, then lets go', () => {
    expect(run.tracker.filming).toBe(false);
    expect(run.frames).toBeLessThan((POST + 3.5) * 60);
  });

  it('snapshots are copies: the race going on does not change them', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup());
    g.start(g.setup);
    for (let i = 0; i < 400; i++) g.update(1 / 60);
    const s = takeSnap(g);
    const d = s.player.d;
    for (let i = 0; i < 60; i++) g.update(1 / 60);
    expect(g.player.d).toBeGreaterThan(d);
    expect(s.player.d).toBe(d);
  });

  it('blends between snapshots, and traffic the short way round the loop', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup());
    g.start(g.setup);
    for (let i = 0; i < 400; i++) g.update(1 / 60);
    const a = takeSnap(g);
    const b: Snap = { ...a, clock: a.clock + 0.1, player: { ...a.player, d: a.player.d + 10 }, cars: a.cars.map((c, k) => (k === 0 ? { ...c, z: 5 } : c)) };
    if (a.cars[0]) a.cars[0] = { ...a.cars[0], z: g.L - 5 };
    const mid = snapAt([a, b], a.clock + 0.05, g.L);
    expect(mid.player.d).toBeCloseTo(a.player.d + 5, 5);
    if (a.cars[0]) expect(Math.min(mid.cars[0].z, g.L - mid.cars[0].z)).toBeLessThan(1);
    // Outside the range it holds the ends.
    expect(snapAt([a, b], a.clock - 5, g.L).player.d).toBe(a.player.d);
    expect(snapAt([a, b], b.clock + 5, g.L).player.d).toBe(b.player.d);
  });

  it('gives the renderer a game-shaped view of a snapshot', () => {
    const m = run.moments[0];
    const s = snapAt(m.snaps, m.t, run.g.L);
    const v = replayView(run.g, s);
    expect(v.track).toBe(run.g.track);
    expect(v.player).toBe(s.player);
    expect(v.popups).toEqual([]);
    expect(v.place()).toBeGreaterThanOrEqual(1);
  });
});

describe('Share Moments timelines', () => {
  it('hype slows down through the hit and leaves a second for the end card', () => {
    const tl = timeline('hype', [-7, 4]);
    expect(tl.end).toBeCloseTo(9, 5);
    expect(tl.slow).not.toBeNull();
    const [s0, s1] = tl.slow ?? [0, 0];
    expect(tl.impact).toBeGreaterThan(s0);
    expect(tl.impact).toBeLessThan(s1);
    expect(sourceAt(tl, tl.impact).src).toBeCloseTo(0, 5);
    expect(sourceAt(tl, (s0 + s1) / 2).rate).toBeLessThan(0.5);
  });

  it('funny freezes on the hit', () => {
    const tl = timeline('funny', [-7, 4]);
    expect(tl.freeze).not.toBeNull();
    const [f0, f1] = tl.freeze ?? [0, 0];
    expect(tl.impact).toBeCloseTo(f0, 5);
    expect(sourceAt(tl, (f0 + f1) / 2)).toEqual({ src: 0, rate: 0 });
  });

  it('clean plays at full speed', () => {
    const tl = timeline('clean', [-7, 4]);
    expect(tl.slow).toBeNull();
    expect(sourceAt(tl, 3).rate).toBeCloseTo(1, 5);
  });

  it('a hit early in the race gets a shorter build up, not frozen frames', () => {
    const tl = timeline('hype', [-2, 4]);
    expect(sourceAt(tl, 0).src).toBeCloseTo(-2, 5);
    expect(tl.end).toBeLessThan(9);
    expect(sourceAt(tl, tl.impact).src).toBeCloseTo(0, 5);
  });

  it('source time only moves forward', () => {
    for (const style of ['hype', 'funny', 'clean'] as const) {
      const tl = timeline(style, [-7, 4]);
      let prev = -Infinity;
      for (let o = 0; o < tl.end; o += 1 / 30) {
        const { src } = sourceAt(tl, o);
        expect(src).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = src;
      }
    }
  });
});
