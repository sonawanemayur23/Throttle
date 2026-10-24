// Guards every art drop: files must be safe, sized, and registered.
import { describe, expect, it } from 'vitest';
import { ART, repaint } from '../engine/svgart';

const sources = import.meta.glob('../art/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const files = Object.keys(sources).map((p) => p.split('/').pop() as string);

describe('art files', () => {
  it('there is art to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    const svg = sources[`../art/${f}`];
    it(`${f}: safe, sized and cleaned`, () => {
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+">/);
      const [, w, h, vw, vh] = svg.match(/width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/) ?? [];
      expect(w).toBe(vw);
      expect(h).toBe(vh);
      expect(svg).not.toMatch(/<(script|image|foreignObject|filter|text|iframe|a)\b/i);
      expect(svg).not.toMatch(/\sdata-[\w-]+=/);
      expect(svg).not.toMatch(/\sstyle=/);
      expect(svg.length).toBeLessThan(40_000);
    });
    it(`${f}: registered in ART`, () => {
      expect(Object.keys(ART)).toContain(f.replace(/\.svg$/, ''));
    });
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
