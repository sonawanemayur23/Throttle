import { describe, expect, it } from 'vitest';
import { BIKES, bikeStats, STOCK } from '../content/bikes';
import { levelDef } from '../content/career';
import { TRACKS } from '../content/tracks';
import { Game, type RaceSetup } from '../engine/game';
import { FakeInput, silentSound } from './stubs';

function setup(trackIdx = 0, level = 1): RaceSetup {
  return { track: TRACKS[trackIdx], bike: bikeStats(BIKES[0], STOCK), level: levelDef(level), tutorial: false };
}

/** A simple bot: hold throttle, follow the road, punch anyone in reach. */
function runRace(g: Game, input: FakeInput, maxSeconds = 200) {
  const dt = 1 / 60;
  g.start(g.setup);
  for (let i = 0; i < maxSeconds * 60 && g.phase !== 'finished'; i++) {
    const p = g.player;
    const L = g.L;
    const pz = ((p.d % L) + L) % L;
    // Dodge the nearest car ahead in our line.
    let tx = 0;
    let nearest = Infinity;
    for (const c of g.cars) {
      let dz = c.z - pz;
      if (dz < -L / 2) dz += L;
      if (dz > L / 2) dz -= L;
      if (dz > 0 && dz < 2500 && Math.abs(c.x - p.x) < 0.45 && dz < nearest) {
        nearest = dz;
        tx = c.x > 0 ? c.x - 0.55 : c.x + 0.55;
      }
    }
    const seg = g.track.find(p.d);
    const want = tx + seg.curve * 0.04;
    input.steer = p.x > want + 0.04 ? -1 : p.x < want - 0.04 ? 1 : 0;
    if (i % 10 === 0) input.press('punch');
    g.update(dt);
  }
}

describe('race simulation', () => {
  it('finishes a race and reports results', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup());
    runRace(g, input);
    expect(g.phase).toBe('finished');
    const r = g.results!;
    expect(r.place).toBeGreaterThanOrEqual(1);
    expect(r.place).toBeLessThanOrEqual(7);
    expect(r.time).toBeGreaterThan(40);
    expect(r.time).toBeLessThan(150);
    expect(r.trackId).toBe('coast');
  });

  for (let t = 0; t < TRACKS.length; t++) {
    it(`a bot can finish ${TRACKS[t].id} in 55 to 110 seconds`, () => {
      const input = new FakeInput();
      const g = new Game(silentSound(), input.asInput(), setup(t, 1));
      runRace(g, input);
      expect(g.phase).toBe('finished');
      expect(g.results!.time).toBeGreaterThan(55);
      expect(g.results!.time).toBeLessThan(110);
    });
  }

  it('a knockout gives the player the rider weapon', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup());
    g.start(g.setup);
    g.phase = 'race';
    const r = g.rivals[0];
    r.weapon = 'club';
    r.d = g.player.d + 40;
    r.x = g.player.x + 0.1;
    r.hp = 10;
    input.press('punch');
    g.update(1 / 60);
    expect(r.down).toBe(true);
    expect(g.player.weapon).toBe('club');
    expect(g.kos).toBe(1);
  });

  it('police bust a crashed player at level 2', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup(0, 2));
    g.start(g.setup);
    g.phase = 'race';
    g.player.d = 50000;
    g.player.crashed = true;
    g.player.downT = 5;
    Object.assign(g.cop, { active: true, d: g.player.d - 50, x: g.player.x, speed: 2000, down: false });
    g.update(1 / 60);
    expect(g.phase).toBe('finished');
    expect(g.results?.busted).toBe(true);
    expect(g.results?.fine).toBe(levelDef(2).fine);
  });

  it('no police at level 1', () => {
    const input = new FakeInput();
    const g = new Game(silentSound(), input.asInput(), setup(0, 1));
    runRace(g, input);
    expect(g.results?.busted).toBe(false);
    expect(g.cop.active).toBe(false);
  });

  it('a faster bike has a higher top speed', () => {
    const slow = bikeStats(BIKES[0], STOCK);
    const fast = bikeStats(BIKES[4], { engine: 3, tyres: 0, armour: 0 });
    expect(fast.topSpeed).toBeGreaterThan(slow.topSpeed);
  });
});
