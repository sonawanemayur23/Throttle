// Track preview images for the career screen, rendered by the real engine so
// they always match the race. Made once per session, after the first paint.

import type { BikeStats } from '../content/bikes';
import { levelDef } from '../content/career';
import type { TrackDef } from '../content/tracks';
import type { Sound } from '../engine/audio';
import { Game } from '../engine/game';
import type { Input } from '../engine/input';
import { Renderer } from '../engine/render';

const cache = new Map<string, string>();
const silent = new Proxy({}, { get: () => () => undefined }) as unknown as Sound;
const still = { lastTouch: false, axis: () => 0, isDown: () => false, take: () => false, clearPressed: () => undefined, throttle: () => false } as unknown as Input;

export function trackThumb(def: TrackDef, bike: BikeStats): string | null {
  const hit = cache.get(def.id);
  if (hit) return hit;
  try {
    const canvas = document.createElement('canvas');
    const r = new Renderer(canvas, { width: 480, height: 270 });
    const g = new Game(silent, still, { track: def, bike, level: levelDef(1), tutorial: false });
    // Pick a stretch with a curve so the preview shows the road's character.
    let d = 40000;
    for (let i = 0; i < def.segments; i += 10) {
      if (Math.abs(g.track.segments[i].curve) > 3 && i * 200 > 30000) {
        d = i * 200 - 4000;
        break;
      }
    }
    g.player.d = d;
    g.player.speed = 0;
    for (let i = 0; i < 3; i++) g.update(1 / 60);
    g.player.speed = 0;
    r.render(g, 0);
    const url = canvas.toDataURL('image/jpeg', 0.82);
    cache.set(def.id, url);
    return url;
  } catch {
    return null;
  }
}
