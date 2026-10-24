#!/usr/bin/env node
// Clean an SVG from Claude Design (or any tool) into a game asset.
//
//   node scripts/clean-svg.mjs <in.svg> <out.svg> [--key=body:#base,#light,#shadow]...
//
// - Strips editor attributes (data-*, style, class except the game's own
//   classes) and the width="100%" wrapper size.
// - Sets width and height from the viewBox.
// - Rejects anything the game cannot draw safely (scripts, images, filters, text).
// - --key maps a drawing's own colors to the game's color keys, so one drawing
//   can be repainted per rider or car. Keys: body, jacket, helmet.
import { readFileSync, writeFileSync } from 'node:fs';

const KEYS = {
  body: ['#FF00FF', '#FF80FF', '#A000A0'],
  jacket: ['#00FFFF', '#80FFFF', '#00A0A0'],
  helmet: ['#FFFF00', '#FFFF99', '#A0A000'],
};
const FORBIDDEN = /<(script|image|foreignObject|filter|text|iframe|a)\b/i;
const GAME_CLASSES = new Set(['tail', 'light-a', 'light-b']);

const [, , input, output, ...flags] = process.argv;
if (!input || !output) {
  console.error('Usage: node scripts/clean-svg.mjs <in.svg> <out.svg> [--key=body:#base,#light,#shadow]');
  process.exit(1);
}
let svg = readFileSync(input, 'utf8').trim();
const m = svg.match(/<svg\b[\s\S]*<\/svg>/i);
if (!m) throw new Error(`${input}: no <svg> element found`);
svg = m[0];
if (FORBIDDEN.test(svg)) throw new Error(`${input}: contains an element the game does not allow (script, image, filter, text)`);
const vb = svg.match(/viewBox="([\d.\s-]+)"/);
if (!vb) throw new Error(`${input}: missing viewBox`);
const [, , vw, vh] = vb[1].trim().split(/\s+/).map(Number);

svg = svg
  .replace(/\sdata-[\w-]+="[^"]*"/g, '')
  .replace(/\sstyle="[^"]*"/g, '')
  .replace(/\sclass="([^"]*)"/g, (_, c) => {
    const keep = c.split(/\s+/).filter((x) => GAME_CLASSES.has(x));
    return keep.length ? ` class="${keep.join(' ')}"` : '';
  })
  .replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">`);

for (const f of flags) {
  const k = f.match(/^--key=(\w+):(#[0-9a-f]{6}),(#[0-9a-f]{6}),(#[0-9a-f]{6})$/i);
  if (!k || !KEYS[k[1]]) throw new Error(`Bad flag ${f}. Use --key=body:#base,#light,#shadow`);
  const [base, light, shadow] = KEYS[k[1]];
  for (const [from, to] of [
    [k[2], base],
    [k[3], light],
    [k[4], shadow],
  ])
    svg = svg.replace(new RegExp(from, 'gi'), to);
}

writeFileSync(output, svg + '\n');
console.log(`${output}: ${vw} x ${vh}, ${(svg.length / 1024).toFixed(1)} KB`);
