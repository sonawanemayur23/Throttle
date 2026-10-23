import { describe, expect, it } from 'vitest';
import { TRACKS } from '../content/tracks';
import { SEG_LEN } from '../engine/config';
import { Track } from '../engine/track';

describe('tracks', () => {
  for (const def of TRACKS) {
    it(`${def.id}: same seed builds the same road`, () => {
      const a = new Track(def);
      const b = new Track(def);
      expect(a.length).toBe(b.length);
      expect(a.segments.map((s) => s.curve)).toEqual(b.segments.map((s) => s.curve));
    });

    it(`${def.id}: loop closes at ground level and has a sane length`, () => {
      const t = new Track(def);
      expect(t.segments[0].p1.world.y).toBe(0);
      expect(t.segments[t.segments.length - 1].p2.world.y).toBe(0);
      // Between 60 and 95 seconds at an average of 80 percent top speed.
      const seconds = t.length / (SEG_LEN * 60 * 0.8);
      expect(seconds).toBeGreaterThan(55);
      expect(seconds).toBeLessThan(95);
    });

    it(`${def.id}: has scenery and a minimap route`, () => {
      const t = new Track(def);
      expect(t.segments.some((s) => s.sprites.length > 0)).toBe(true);
      expect(t.map.length).toBeGreaterThan(100);
      for (const p of t.map) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
      }
    });
  }
});
