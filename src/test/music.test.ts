import { describe, expect, it } from 'vitest';
import { TRACKS } from '../content/tracks';
import { SCORES, midiOf, musicDuck, musicForTrack, parseDrums, parsePitched, stepDuration, type MusicId } from '../engine/music';

const IDS: MusicId[] = ['menu', 'coast', 'desert', 'mountain', 'city'];

describe('music', () => {
  it('parses rests, holds and chords onto one grid', () => {
    const { hits, steps } = parsePitched('.:2 A4:2 C4+E4:4', 0.5);
    expect(steps).toBe(8);
    expect(hits.map((h) => [h.step, h.midi, h.dur])).toEqual([
      [2, 69, 2],
      [4, 60, 4],
      [4, 64, 4],
    ]);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#2')).toBe(42);
  });

  it('treats X as an accent and ignores spaces in drum lines', () => {
    const { hits, steps } = parseDrums('x..X .', 1);
    expect(steps).toBe(5);
    expect(hits.map((h) => [h.step, h.vel])).toEqual([
      [0, 0.7],
      [3, 1],
    ]);
  });

  it('loops a whole number of bars for the menu and every highway', () => {
    expect(Object.keys(SCORES).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      const score = SCORES[id];
      expect(score.steps).toBe(64);
      expect(score.byStep).toHaveLength(64);
      expect(score.bpm).toBeGreaterThanOrEqual(90);
      expect(score.bpm).toBeLessThanOrEqual(140);
      expect(stepDuration(score.bpm)).toBeCloseTo(60 / score.bpm / 4);
      for (const events of score.byStep) {
        for (const ev of events) {
          expect(ev.dur).toBeGreaterThan(0);
          expect(ev.vel).toBeGreaterThan(0);
          expect(ev.vel).toBeLessThanOrEqual(1);
          if (ev.voice === 'kick' || ev.voice === 'snare' || ev.voice === 'hat') expect(ev.midi).toBe(0);
          else expect(ev.midi).toBeGreaterThanOrEqual(28);
          expect(ev.midi).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('gives each track its own loop and sends anything else to the menu', () => {
    for (const t of TRACKS) expect(musicForTrack(t.id)).toBe(t.id);
    expect(musicForTrack('menu')).toBe('menu');
    expect(musicForTrack('nope')).toBe('menu');
  });

  it('ducks under the engine and returns to full level when the engine stops', () => {
    expect(musicDuck(false, 1)).toBe(1);
    expect(musicDuck(true, 0)).toBeCloseTo(0.7);
    expect(musicDuck(true, 1)).toBeCloseTo(0.3);
    expect(musicDuck(true, 1)).toBeLessThan(musicDuck(true, 0));
  });
});
