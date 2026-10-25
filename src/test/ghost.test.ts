import { describe, expect, it } from 'vitest';
import { GHOST_STEP, GhostRecorder, decodeGhost, encodeGhost, ghostAt, ghostGap, type Ghost } from '../engine/ghost';
import { Game } from '../engine/game';
import { raceSetup } from '../app/setup';
import { newSave } from '../save/save';
import { FakeInput, silentSound } from './stubs';

function sampleGhost(): Ghost {
  const rec = new GhostRecorder();
  // 80 seconds at a varying speed, weaving across the road.
  let d = 0;
  for (let t = 0; t <= 80; t += 1 / 60) {
    d += (9000 + 3000 * Math.sin(t / 5)) / 60;
    rec.sample(t, d, Math.sin(t) * 0.8);
  }
  return { trackId: 'desert', level: 3, bikeId: 'shrike', time: 80.437, place: 2, name: 'Mayur', d: rec.d, x: rec.x };
}

describe('ghost recording', () => {
  it('keeps one sample per step', () => {
    const g = sampleGhost();
    // One per step; the last may fall just past the loop end.
    expect(Math.abs(g.d.length - 80 / GHOST_STEP)).toBeLessThanOrEqual(1);
  });

  it('packs into a short link and comes back the same', () => {
    const g = sampleGhost();
    const code = encodeGhost(g);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(1000);
    const back = decodeGhost(code);
    expect(back).not.toBeNull();
    if (!back) return;
    expect(back).toMatchObject({ trackId: 'desert', level: 3, bikeId: 'shrike', place: 2, name: 'Mayur' });
    expect(back.time).toBeCloseTo(80.437, 3);
    expect(back.d.length).toBe(g.d.length);
    // Rounding never drifts: every point stays within half a unit of the original.
    for (let i = 0; i < g.d.length; i++) {
      expect(Math.abs(back.d[i] - g.d[i])).toBeLessThanOrEqual(25);
      expect(Math.abs(back.x[i] - g.x[i])).toBeLessThanOrEqual(0.011);
    }
  });

  it('rejects broken or foreign codes', () => {
    expect(decodeGhost('')).toBeNull();
    expect(decodeGhost('hello')).toBeNull();
    expect(decodeGhost('AAAA')).toBeNull();
    const code = encodeGhost(sampleGhost());
    expect(decodeGhost(code.slice(0, 40))).toBeNull();
  });

  it('finds the ghost and the gap', () => {
    const g = decodeGhost(encodeGhost(sampleGhost()));
    if (!g) throw new Error('decode failed');
    const mid = ghostAt(g, 10);
    expect(mid.d).toBeGreaterThan(g.d[39]);
    expect(mid.d).toBeLessThan(g.d[41]);
    // At the ghost's own spot at 10 s, the gap is 0; one second later it is 1 s behind.
    expect(ghostGap(g, mid.d, 10)).toBeCloseTo(0, 1);
    expect(ghostGap(g, mid.d, 11)).toBeCloseTo(1, 1);
  });

  it('a real race records itself', () => {
    const game = new Game(silentSound(), new FakeInput().asInput(), raceSetup(newSave(), 1, 'coast'));
    game.start(raceSetup(newSave(), 1, 'coast'));
    for (let i = 0; i < 60 * 8; i++) game.update(1 / 60);
    expect(game.recorder.d.length).toBeGreaterThan(15);
    expect(game.recorder.d.at(-1)).toBeGreaterThan(game.recorder.d[0]);
  });
});
