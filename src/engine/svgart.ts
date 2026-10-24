// SVG game art. Each asset is an SVG file in src/art/, drawn in the style set
// by docs/ART.md. At run time an asset is:
//   1. repainted: color keys swapped for a rider's or car's own colors,
//   2. rasterized once into a canvas at a size bucket (64, 128 ... 1024 px tall),
//   3. stamped with drawImage, anchored at its bottom center.
// Until an image has loaded, `get` returns null and callers draw their
// code-drawn fallback, so the game never waits on art.

import carSedan from '../art/car-sedan.svg?raw';
import coastPalm from '../art/coast-palm-tall.svg?raw';
import coastRock from '../art/coast-rock.svg?raw';
import mountainPine from '../art/mountain-pine-tall.svg?raw';
import riderRide from '../art/rider-ride.svg?raw';
import riderPunch from '../art/rider-punch.svg?raw';
import riderKick from '../art/rider-kick.svg?raw';
import riderHurt from '../art/rider-hurt.svg?raw';
import riderClubHold from '../art/rider-club-hold.svg?raw';
import riderClubSwing from '../art/rider-club-swing.svg?raw';
import riderChainHold from '../art/rider-chain-hold.svg?raw';
import riderChainSwing from '../art/rider-chain-swing.svg?raw';
import riderCrashA from '../art/rider-crash-a.svg?raw';
import riderCrashB from '../art/rider-crash-b.svg?raw';

export interface ArtDef {
  svg: string;
  /** viewBox size. */
  vw: number;
  vh: number;
  /**
   * Drawn width as a multiple of the sprite width the renderer passes in.
   * For props that is the scenery size from SPRITE_W; for cars, the car body.
   */
  fit: number;
}

function def(svg: string, fit: number): ArtDef {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) throw new Error('Art is missing a viewBox');
  return { svg, vw: Number(m[1]), vh: Number(m[2]), fit };
}

/**
 * Riders: the bike tail spans 160 of the 400 px box. The code-drawn rider's
 * tail is about 0.58 of the sprite width, so the box is 1.45 sprite widths.
 */
const RIDER_FIT = (400 / 160) * 0.58;

/** The art the game ships. Keys are asset names; see docs/ART.md. */
export const ART = {
  'car-sedan': def(carSedan, 480 / 400),
  'coast-palm-tall': def(coastPalm, 1.7),
  'mountain-pine-tall': def(mountainPine, 1.2),
  'coast-rock': def(coastRock, 1.05),
  'rider-ride': def(riderRide, RIDER_FIT),
  'rider-punch': def(riderPunch, RIDER_FIT),
  'rider-kick': def(riderKick, RIDER_FIT),
  'rider-hurt': def(riderHurt, RIDER_FIT),
  'rider-club-hold': def(riderClubHold, RIDER_FIT),
  'rider-club-swing': def(riderClubSwing, RIDER_FIT),
  'rider-chain-hold': def(riderChainHold, RIDER_FIT),
  'rider-chain-swing': def(riderChainSwing, RIDER_FIT),
  'rider-crash-a': def(riderCrashA, RIDER_FIT),
  'rider-crash-b': def(riderCrashB, RIDER_FIT),
} satisfies Record<string, ArtDef>;

export type ArtName = keyof typeof ART;

/** Color keys used in the art files, base, light and shadow tones. */
const KEYS = {
  body: ['#FF00FF', '#FF80FF', '#A000A0'],
  jacket: ['#00FFFF', '#80FFFF', '#00A0A0'],
  helmet: ['#FFFF00', '#FFFF99', '#A0A000'],
} as const;
export type KeyName = keyof typeof KEYS;
export type Paint = Partial<Record<KeyName, string>>;

function tone(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  const c = [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function repaint(svg: string, paint: Paint) {
  let out = svg;
  for (const k of Object.keys(paint) as KeyName[]) {
    const c = paint[k];
    if (!c) continue;
    const [base, light, shadow] = KEYS[k];
    out = out.replace(new RegExp(base, 'gi'), c).replace(new RegExp(light, 'gi'), tone(c, 0.38)).replace(new RegExp(shadow, 'gi'), tone(c, -0.42));
  }
  return out;
}

const BUCKETS = [64, 128, 256, 512, 1024];

export class SvgArt {
  private images = new Map<string, HTMLImageElement>();
  private rasters = new Map<string, HTMLCanvasElement>();

  /** Start loading the base images so the first race already has art. */
  preload(names: ArtName[] = Object.keys(ART) as ArtName[]) {
    for (const n of names) this.image(n, {});
  }

  /** Start decoding these assets in these colors before they are needed. */
  warm(names: ArtName[], paints: Paint[]) {
    for (const n of names) for (const p of paints) this.image(n, p);
  }

  private image(name: ArtName, paint: Paint) {
    const key = `${name}|${paint.body ?? ''}|${paint.jacket ?? ''}|${paint.helmet ?? ''}`;
    let img = this.images.get(key);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(repaint(ART[name].svg, paint));
      this.images.set(key, img);
    }
    return { key, img };
  }

  /** A canvas of the asset at least `px` tall, or null while it loads. */
  get(name: ArtName, px: number, paint: Paint = {}): HTMLCanvasElement | null {
    const { key, img } = this.image(name, paint);
    if (!img.complete || img.naturalWidth === 0) return null;
    const bucket = BUCKETS.find((b) => b >= px) ?? BUCKETS[BUCKETS.length - 1];
    const rkey = `${key}|${bucket}`;
    let c = this.rasters.get(rkey);
    if (!c) {
      const a = ART[name];
      c = document.createElement('canvas');
      c.height = bucket;
      c.width = Math.max(1, Math.round((bucket * a.vw) / a.vh));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      this.rasters.set(rkey, c);
    }
    return c;
  }

  /**
   * Draw an asset with its bottom center at (x, y). `w` is the sprite width
   * from the renderer. Returns false if the art is not ready yet.
   */
  draw(ctx: CanvasRenderingContext2D, name: ArtName, x: number, y: number, w: number, paint: Paint = {}) {
    const a = ART[name];
    const dw = w * a.fit;
    const dh = (dw * a.vh) / a.vw;
    if (dh < 1) return true;
    const c = this.get(name, dh, paint);
    if (!c) return false;
    ctx.drawImage(c, x - dw / 2, y - dh, dw, dh);
    return true;
  }
}

/** One shared instance: sprites and the renderer both draw from it. */
export const svgArt = new SvgArt();
