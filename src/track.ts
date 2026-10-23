import { RUMBLE_LEN, SEG_LEN, TRACK_SEGMENTS_TARGET } from './config';
import { easeIn, easeInOut, mulberry32 } from './util';

export interface Pt {
  world: { x: number; y: number; z: number };
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number; scale: number };
}

export type SpriteKind = 'palm' | 'rock' | 'sign' | 'bush' | 'post' | 'arch';

export interface Sprite {
  kind: SpriteKind;
  offset: number;
  variant: number;
}

export interface Segment {
  index: number;
  p1: Pt;
  p2: Pt;
  curve: number;
  dark: boolean;
  start: boolean;
  clip: number;
  sprites: Sprite[];
}

const pt = (y: number, z: number): Pt => ({
  world: { x: 0, y, z },
  camera: { x: 0, y: 0, z: 0 },
  screen: { x: 0, y: 0, w: 0, scale: 0 },
});

const CURVE = { EASY: 2, MEDIUM: 4, HARD: 6 };
const HILL = { LOW: 20, MEDIUM: 40, HIGH: 60 };
const LEN = { SHORT: 25, MEDIUM: 50, LONG: 100 };

export class Track {
  segments: Segment[] = [];
  length = 0;

  constructor(seed = 7) {
    const rng = mulberry32(seed);
    const s = this.segments;
    const lastY = () => (s.length === 0 ? 0 : s[s.length - 1].p2.world.y);

    const addSegment = (curve: number, y: number) => {
      const n = s.length;
      s.push({
        index: n,
        p1: pt(lastY(), n * SEG_LEN),
        p2: pt(y, (n + 1) * SEG_LEN),
        curve,
        dark: Math.floor(n / RUMBLE_LEN) % 2 === 1,
        start: false,
        clip: 0,
        sprites: [],
      });
    };

    const addRoad = (enter: number, hold: number, leave: number, curve: number, y: number) => {
      const startY = lastY();
      const endY = startY + y * SEG_LEN;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
      for (let n = 0; n < hold; n++) addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
      for (let n = 0; n < leave; n++) addSegment(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    };

    const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
    const sign = () => (rng() < 0.5 ? -1 : 1);

    const straight = (n = LEN.MEDIUM) => addRoad(n, n, n, 0, 0);
    const hill = (n = LEN.MEDIUM, h = HILL.MEDIUM) => addRoad(n, n, n, 0, h);
    const curve = (n = LEN.MEDIUM, c = CURVE.MEDIUM, h = 0) => addRoad(n, n, n, c, h);
    const sCurves = () => {
      const d = sign();
      addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY * d, 0);
      addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.MEDIUM * d, HILL.MEDIUM * sign());
      addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, CURVE.EASY * d, -HILL.LOW);
      addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.EASY * d, HILL.MEDIUM * sign());
      addRoad(LEN.MEDIUM, LEN.MEDIUM, LEN.MEDIUM, -CURVE.MEDIUM * d, -HILL.MEDIUM);
    };
    const bumps = () => {
      for (const h of [5, -2, -5, 8, 5, -7, 5, -2]) addRoad(10, 10, 10, 0, h);
    };
    const rolling = () => {
      const h = HILL.LOW / 2;
      for (const y of [h, -h, h, 0, h / 2, 0]) addRoad(LEN.SHORT, LEN.SHORT, LEN.SHORT, 0, y);
    };

    // Start straight, then a random but fair sequence of pieces.
    straight(LEN.SHORT);
    rolling();
    const pieces = [
      () => curve(LEN.MEDIUM, CURVE.MEDIUM * sign(), HILL.LOW * sign()),
      () => curve(LEN.LONG, CURVE.EASY * sign(), 0),
      () => curve(LEN.SHORT, CURVE.HARD * sign(), 0),
      () => hill(LEN.MEDIUM, HILL.HIGH * sign()),
      () => sCurves(),
      () => bumps(),
      () => straight(LEN.MEDIUM),
      () => curve(LEN.LONG, CURVE.MEDIUM * sign(), HILL.MEDIUM * sign()),
    ];
    while (s.length < TRACK_SEGMENTS_TARGET - 300) pick(pieces)();
    // Bring the road back to ground level and straighten it to close the loop.
    const descend = () => addRoad(200, 200, 200, -CURVE.EASY, -lastY() / SEG_LEN);
    descend();
    straight(LEN.SHORT);

    // Fix rounding so the loop closes exactly at height 0.
    const last = s[s.length - 1];
    last.p2.world.y = 0;

    for (let i = 0; i < 3; i++) s[i].start = true;

    // Roadside scenery.
    s[6].sprites.push({ kind: 'arch', offset: 0, variant: 0 });
    for (let i = 20; i < s.length - 10; i += 2 + Math.floor(rng() * 4)) {
      const r = rng();
      const side = sign();
      if (r < 0.45) s[i].sprites.push({ kind: 'palm', offset: side * (1.3 + rng() * 1.6), variant: rng() });
      else if (r < 0.62) s[i].sprites.push({ kind: 'bush', offset: side * (1.2 + rng() * 2), variant: rng() });
      else if (r < 0.75) s[i].sprites.push({ kind: 'rock', offset: side * (1.4 + rng() * 2.2), variant: rng() });
      else if (r < 0.8) s[i].sprites.push({ kind: 'sign', offset: side * 1.35, variant: rng() });
      if (i % 12 === 0) {
        s[i].sprites.push({ kind: 'post', offset: -1.12, variant: 0 });
        s[i].sprites.push({ kind: 'post', offset: 1.12, variant: 0 });
      }
    }

    this.length = s.length * SEG_LEN;
    this.map = this.buildMap();
  }

  /** Top-down route for the minimap: integrate the curves into a heading. Points in 0..1. */
  map: Array<{ x: number; y: number }> = [];

  private buildMap() {
    const pts: Array<{ x: number; y: number }> = [];
    let ang = 0;
    let x = 0;
    let y = 0;
    const step = 6;
    for (let i = 0; i < this.segments.length; i += step) {
      let c = 0;
      for (let k = 0; k < step && i + k < this.segments.length; k++) c += this.segments[i + k].curve;
      ang += c * 0.0042;
      x += Math.sin(ang) * step;
      y -= Math.cos(ang) * step;
      pts.push({ x, y });
    }
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
    const offX = (span - (Math.max(...xs) - minX)) / 2;
    const offY = (span - (Math.max(...ys) - minY)) / 2;
    return pts.map((p) => ({ x: (p.x - minX + offX) / span, y: (p.y - minY + offY) / span }));
  }

  /** Map position for a distance along the race. */
  mapAt(d: number) {
    const t = Math.max(0, Math.min(0.9999, d / this.length)) * (this.map.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    const a = this.map[i];
    const b = this.map[Math.min(i + 1, this.map.length - 1)];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  find(z: number): Segment {
    const n = this.segments.length;
    return this.segments[((Math.floor(z / SEG_LEN) % n) + n) % n];
  }
}
