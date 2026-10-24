// Guards every art drop: files must be safe, sized, and registered.
import { describe, expect, it } from 'vitest';
import { ART, repaint } from '../engine/svgart';

const sources = import.meta.glob('../art/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const files = Object.keys(sources).map((p) => p.split('/').pop() as string);
// Garage art is drawn by the menus, not the race engine, so it is not in ART.
const garage = import.meta.glob('../art/garage/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function checkSafe(svg: string) {
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+">/);
  const [, w, h, vw, vh] = svg.match(/width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/) ?? [];
  expect(w).toBe(vw);
  expect(h).toBe(vh);
  expect(svg).not.toMatch(/<(script|image|foreignObject|filter|text|iframe|a)\b/i);
  expect(svg).not.toMatch(/\sdata-[\w-]+=/);
  expect(svg).not.toMatch(/\sstyle=/);
  expect(svg.length).toBeLessThan(40_000);
}

describe('art files', () => {
  it('there is art to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    const svg = sources[`../art/${f}`];
    it(`${f}: safe, sized and cleaned`, () => checkSafe(svg));
    it(`${f}: registered in ART`, () => {
      expect(Object.keys(ART)).toContain(f.replace(/\.svg$/, ''));
    });
  }

  it('garage has 5 bikes and 9 parts', () => {
    expect(Object.keys(garage).length).toBe(14);
  });
  for (const [p, svg] of Object.entries(garage)) {
    it(`garage/${p.split('/').pop()}: safe, sized and cleaned`, () => checkSafe(svg));
  }
});

describe('repaint', () => {
  it('swaps all three tones of a color key', () => {
    const svg = '<path fill="#FF00FF"/><path fill="#ff80ff"/><path fill="#A000A0"/>';
    const out = repaint(svg, { body: '#1e5fbf' });
    expect(out).not.toMatch(/#FF00FF|#FF80FF|#A000A0/i);
    expect(out).toContain('#1e5fbf');
  });

  it('leaves other colors alone', () => {
    expect(repaint('<path fill="#14101F"/>', { body: '#000000' })).toBe('<path fill="#14101F"/>');
  });
});

describe('lights', () => {
  it('finds tail lights on every vehicle and the police bike', () => {
    for (const n of ['car-sedan', 'car-hatch', 'car-suv', 'car-van', 'car-pickup', 'truck-semi', 'police-ride'] as const) {
      expect(ART[n].lights.tail.length, n).toBeGreaterThan(0);
    }
  });

  it('finds both halves of the police light bar', () => {
    expect(ART['police-ride'].lights['light-a'].length).toBeGreaterThan(0);
    expect(ART['police-ride'].lights['light-b'].length).toBeGreaterThan(0);
  });

  it('dims one half of the light bar', () => {
    const out = repaint(ART['police-ride'].svg, { dim: 'a' });
    expect(out).toContain('class="light-a" opacity="0.28"');
    expect(out).not.toContain('class="light-b" opacity');
  });
});
