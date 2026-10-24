import {
  BIKE_WORLD_W,
  CAM_DEPTH,
  CAM_H,
  CAR_WORLD_W,
  DRAW_DIST,
  FOG_DENSITY,
  LANES,
  MAX_SPEED,
  PLAYER_Z,
  ROAD_W,
  SEG_LEN,
} from './config';
import type { Palette, TrackDef } from '../content/tracks';
import { WEAPONS, type Car, type Cop, type Game, type Rider, type Rival, type ScreenPos } from './game';
import {
  drawArch,
  drawBuilding,
  drawBush,
  drawCactus,
  drawCar,
  drawLamp,
  drawPalm,
  drawPine,
  drawPost,
  drawRider,
  drawRock,
  drawSign,
  type RiderLook,
} from './sprites';
import type { Pt, Segment, Sprite } from './track';
import { SpriteCache } from './art';
import { ART, PROP_SCALE, svgArt, type ArtName } from './svgart';

const NAMES = Object.keys(ART) as ArtName[];
const RIDER_POSES = NAMES.filter((n) => n.startsWith('rider-'));
const POLICE_POSES = NAMES.filter((n) => n.startsWith('police-'));
const CARS = NAMES.filter((n) => n.startsWith('car-'));

/** One drawing, or several picked by the sprite's variant. */
type SceneryArt = Partial<Record<Sprite['kind'], ArtName | ArtName[]>>;
/** Scenery drawn from SVG art, per track, instead of the cached code-drawn stamps. */
const SVG_SCENERY: Record<string, SceneryArt> = {
  coast: {
    palm: 'coast-palm-tall',
    palm2: 'coast-palm-pair',
    bush: 'coast-shrub',
    rock: 'coast-rock',
    tower: 'coast-tower',
    sign: 'coast-billboard',
  },
  desert: {
    cactus: 'desert-cactus-tall',
    cactus2: 'desert-cactus-small',
    rock: 'desert-rock',
    bush: 'desert-bush',
    windmill: 'desert-windmill',
    sign: 'desert-sign',
  },
  mountain: {
    pine: ['mountain-pine-tall', 'mountain-pine-short'],
    deadpine: 'mountain-pine-dead',
    rock: 'mountain-boulder',
    logs: 'mountain-logs',
    cliff: 'mountain-rockface',
    sign: 'mountain-sign',
  },
  city: {
    building: ['city-tower-a', 'city-tower-b', 'city-tower-c'],
    shop: 'city-shopfront',
    lamp: 'city-lamp',
    trafficlight: 'city-trafficlight',
    busstop: 'city-busstop',
  },
};
/**
 * How a prop is placed. `ax`: the ground point's x in the art's viewBox when it
 * is not the center (a pole at one side). `mirror`: 'never' for anything with
 * a fixed direction or words, 'road' to turn arms over the road; otherwise half
 * are mirrored at random.
 */
const PROP_PLACE: Partial<Record<ArtName, { ax?: number; mirror?: 'never' | 'road' }>> = {
  'city-lamp': { ax: 38, mirror: 'road' },
  'city-trafficlight': { ax: 38, mirror: 'road' },
  'mountain-sign': { mirror: 'never' },
};
/** Lamp heads that glow at night: center and radius in viewBox units. */
const PROP_GLOW: Partial<Record<ArtName, [number, number, number]>> = {
  'city-lamp': [175, 58, 70],
};
/** Ink for sign words when not the outline color, for neon on dark panels. */
const SIGN_INK: Partial<Record<ArtName, string>> = {
  'city-shopfront': '#FF6FB5',
};
/** Words printed on sign panels, one set per panel, picked by the sprite's variant. */
const SIGN_WORDS: Partial<Record<ArtName, string[][]>> = {
  'coast-billboard': [['MOTEL', 'SURF SHOP', 'DINER', 'TACOS', 'COLD DRINKS', 'FUEL 24/7', 'ICE CREAM', 'BAIT & TACKLE']],
  'desert-sign': [
    ['FUEL', 'EATS', 'MOTEL', 'GAS', 'CAFE', 'TOW'],
    ['OPEN 24/7', 'LAST STOP', '12 MI', 'COLD BEER', 'VACANCY', 'NEXT EXIT'],
  ],
  'city-shopfront': [['PIZZA', 'NOODLES', 'ARCADE', 'DINER', 'RECORDS', 'KARAOKE', 'OPEN 24 HR', 'LAUNDRY', 'BURGERS']],
};
/** Horizon strips per track, back to front, named `horizon-<track>-<layer>`. */
const HORIZON_LAYERS = ['far', 'mid', 'near'];
/** Strip height as a share of the screen height. */
const HORIZON_H = 0.36;
/**
 * Sun and moon art. `size`: drawn width as a share of the sky unit
 * (min of width and 1.4 x height). `y`: center height as a share of the screen.
 */
const SKY_BODY: Partial<Record<Palette['sun'], { art: ArtName; size: number; y: number }>> = {
  sun: { art: 'sky-sun-sunset', size: 0.3, y: 0.4 },
  noon: { art: 'sky-sun-noon', size: 0.155, y: 0.14 },
  pale: { art: 'sky-sun-pale', size: 0.15, y: 0.3 },
  moon: { art: 'sky-moon', size: 0.12, y: 0.17 },
};
const OUTLINE = '#14101F';
const PLAYER_JACKET = '#2b2f3a';
const PLAYER_HELMET = '#f2f2f2';
import { hex, lerp, mix, mod, mulberry32, ordinal, type RGB } from './util';

const HUD_FONT = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
/** Sample the palette's 4 sky stops into `n` flat bands. */
function skyBands(p: Palette, n: number) {
  const stops: Array<[number, RGB]> = [
    [0, hex(p.sky[0])],
    [0.45, hex(p.sky[1])],
    [0.8, hex(p.sky[2])],
    [1, hex(p.sky[3])],
  ];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    out.push(mix(c0, c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))));
  }
  return out;
}

interface RoadColors {
  fog: RGB;
  road: RGB[];
  ground: RGB[];
  rumble: RGB[];
  lane: RGB;
  start: RGB;
}

const roadColors = (p: Palette): RoadColors => ({
  fog: hex(p.fog),
  road: p.road.map(hex),
  ground: p.ground.map(hex),
  rumble: p.rumble.map(hex),
  lane: hex(p.lane),
  start: hex('#ffffff'),
});

const SPRITE_W: Record<Sprite['kind'], number> = {
  palm: 700,
  palm2: 900,
  tower: 800,
  windmill: 700,
  cactus2: 400,
  bush: 650,
  rock: 800,
  sign: 1100,
  post: 60,
  arch: ROAD_W * 2.3,
  cactus: 520,
  pine: 760,
  building: 1500,
  lamp: 110,
  deadpine: 500,
  logs: 900,
  cliff: 1400,
  shop: 1300,
  trafficlight: 120,
  busstop: 1100,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
  round?: boolean;
}

type Drawable =
  | { kind: 'sprite'; s: Sprite }
  | { kind: 'car'; c: Car }
  | { kind: 'rival'; r: Rival }
  | { kind: 'cop'; c: Cop };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  /** Horizontal projection scale. On tall screens we crop a wider view so the bike stays big. */
  kx = 0;
  private skyOffset = 0;
  private parts: Particle[] = [];
  private buckets: Drawable[][] = Array.from({ length: DRAW_DIST }, () => []);
  private ridges: number[][];
  private stars: Array<[number, number, number]> = [];
  private def: TrackDef | null = null;
  private C: RoadColors | null = null;
  private night = false;
  private cache = new SpriteCache();
  private vignette: HTMLCanvasElement | null = null;
  /** Flat sky band colors, top to horizon, for the current track. */
  private bands: string[] = [];
  private lines: Array<{ a: number; r: number; len: number; speed: number }> = [];

  /** Pass `fixed` to draw at a set size (track previews) instead of filling the window. */
  constructor(
    private canvas: HTMLCanvasElement,
    private fixed?: { width: number; height: number },
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    const rng = mulberry32(3);
    this.ridges = [0, 1, 2].map((layer) => {
      const pts: number[] = [];
      let v = 0.5;
      for (let i = 0; i < 64; i++) {
        v += (rng() - 0.5) * (0.35 - layer * 0.08);
        v = Math.max(0.1, Math.min(1, v));
        pts.push(v);
      }
      return pts;
    });
    for (let i = 0; i < 90; i++) this.stars.push([rng(), rng() * 0.5, rng()]);
    for (let i = 0; i < 40; i++) this.lines.push({ a: Math.random() * Math.PI * 2, r: Math.random(), len: 0.1 + Math.random() * 0.2, speed: 1 + Math.random() });
    svgArt.preload();
    this.resize();
  }

  resize() {
    if (this.fixed) {
      this.canvas.width = this.fixed.width;
      this.canvas.height = this.fixed.height;
      this.w = this.fixed.width;
      this.h = this.fixed.height;
      this.kx = Math.max(this.w, this.h * 1.35) / 2;
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    // Cap the pixel count so mid range phones keep 60 fps.
    const scale = Math.min(dpr, Math.sqrt(1_400_000 / (cw * ch)));
    this.canvas.width = Math.round(cw * scale);
    this.canvas.height = Math.round(ch * scale);
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.kx = Math.max(this.w, this.h * 1.35) / 2;
  }

  private project(p: Pt, camX: number, camY: number, camZ: number) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = CAM_DEPTH / p.camera.z;
    p.screen.x = Math.round(this.w / 2 + p.screen.scale * p.camera.x * this.kx);
    p.screen.y = Math.round(this.h / 2 - (p.screen.scale * p.camera.y * this.h) / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD_W * this.kx);
  }

  private warmedRiders = '';

  /** Decode every rider pose in every rider's colors once per race setup. */
  private warmRiders(g: Game) {
    const key = g.setup.bike.color + g.rivals.map((r) => r.color).join('');
    if (key === this.warmedRiders) return;
    this.warmedRiders = key;
    const paints = [
      { body: g.setup.bike.color, jacket: PLAYER_JACKET, helmet: PLAYER_HELMET },
      ...g.rivals.map((r) => ({ body: r.color, jacket: r.color, helmet: r.helmet })),
    ];
    svgArt.warm(RIDER_POSES, paints);
    svgArt.warm(POLICE_POSES, [{ dim: 'a' }, { dim: 'b' }]);
    svgArt.warm(CARS, [...new Set(g.cars.map((c) => c.color))].map((body) => ({ body })));
  }

  render(g: Game, dt: number) {
    const ctx = this.ctx;
    this.warmRiders(g);
    const { w, h } = this;
    const L = g.L;
    const p = g.player;
    const track = g.track;
    const segs = track.segments;
    const camZ = mod(p.d - PLAYER_Z, L);
    const base = track.find(camZ);
    const basePct = (camZ % SEG_LEN) / SEG_LEN;
    const pz = mod(p.d, L);
    const pSeg = track.find(pz);
    const pPct = (pz % SEG_LEN) / SEG_LEN;
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    const speedPct = p.speed / MAX_SPEED;

    this.skyOffset += pSeg.curve * speedPct * dt * 0.0015;
    if (this.def !== g.track.def) {
      this.def = g.track.def;
      this.C = roadColors(this.def.palette);
      this.night = !!this.def.palette.night;
      this.bands = skyBands(this.def.palette, 14);
      this.cache.prewarm(this.def.scenery.map(([k]) => k));
    }

    ctx.save();
    if (!g.reduceMotion && g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * (w / 800), (Math.random() - 0.5) * g.shake * (w / 800));

    this.drawSky(playerY);

    // Bucket every visible entity by how many segments ahead of the camera it is.
    for (const b of this.buckets) b.length = 0;
    const bucketOf = (z: number) => {
      const n = mod(Math.floor(z / SEG_LEN) - base.index, segs.length);
      return n >= 1 && n < DRAW_DIST ? n : -1;
    };
    for (const c of g.cars) {
      c.visible = false;
      const n = bucketOf(c.z);
      if (n > 0) this.buckets[n].push({ kind: 'car', c });
    }
    // Riders far behind the player would fill the screen, so only draw those near or ahead.
    const pBucketEarly = mod(pSeg.index - base.index, segs.length);
    for (const r of g.rivals) {
      r.visible = false;
      if (g.phase === 'title') continue;
      const n = bucketOf(mod(r.d, L));
      if (n > 0 && n >= pBucketEarly - 1) this.buckets[n].push({ kind: 'rival', r });
    }
    const cop = g.cop;
    cop.visible = false;
    if (cop.active && g.phase !== 'title') {
      const n = bucketOf(mod(cop.d, L));
      if (n > 0 && n >= pBucketEarly - 1) this.buckets[n].push({ kind: 'cop', c: cop });
    }

    // Road, front to back, with hill occlusion.
    let maxy = h;
    let x = 0;
    let dx = -(base.curve * basePct);
    const camX = p.x * ROAD_W;
    const camY = playerY + CAM_H;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[(base.index + n) % segs.length];
      const looped = seg.index < base.index;
      const fog = 1 / Math.pow(Math.E, (n / DRAW_DIST) ** 2 * FOG_DENSITY);
      const cz = camZ - (looped ? L : 0);
      this.project(seg.p1, camX - x, camY, cz);
      this.project(seg.p2, camX - x - dx, camY, cz);
      x += dx;
      dx += seg.curve;
      seg.clip = maxy;
      (seg as Segment & { fog: number }).fog = fog;
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      this.drawSegment(seg, fog, n);
      maxy = seg.p1.screen.y;
    }

    // Player screen placement.
    const pScale = CAM_DEPTH / PLAYER_Z;
    const py = h / 2 - (pScale * lerp(pSeg.p1.camera.y, pSeg.p2.camera.y, pPct) * h) / 2;
    const pw = BIKE_WORLD_W * pScale * this.kx * 1.08;
    const bounce = Math.abs(p.x) > 1.05 && speedPct > 0.2 ? (Math.random() - 0.5) * pw * 0.05 : 0;
    p.sx = w / 2;
    p.sy = py;
    p.sw = pw;
    p.visible = true;
    const pBucket = mod(pSeg.index - base.index, segs.length);
    let playerDrawn = false;
    const drawPlayer = () => {
      playerDrawn = true;
      const inv = (p as Rider & { invuln: number }).invuln;
      if (inv > 0 && !p.down && Math.floor(g.clock * 16) % 2 === 1) return;
      drawRider(ctx, w / 2, py + bounce, pw, { ...this.look(p, g.setup.bike.color, PLAYER_HELMET), jacket: PLAYER_JACKET, player: true, night: this.night, speed: speedPct });
    };

    if (this.night && g.phase !== 'title') this.headlight(py, pw);

    // Sprites and entities, back to front. The player slots in at its own depth.
    for (let n = DRAW_DIST - 1; n > 0; n--) {
      if (n < pBucket && !playerDrawn) drawPlayer();
      const seg = segs[(base.index + n) % segs.length];
      const s1 = seg.p1.screen;
      if (seg.p1.camera.z <= CAM_DEPTH) continue;
      const fogA = 1 - ((seg as Segment & { fog?: number }).fog ?? 1);
      for (const sp of seg.sprites) {
        const sw = SPRITE_W[sp.kind] * s1.scale * this.kx;
        const sx = s1.x + s1.scale * sp.offset * ROAD_W * this.kx;
        this.clipped(seg.clip, s1.y, () => this.drawSprite(sp, sx, s1.y, sw), fogA);
      }
      for (const d of this.buckets[n]) {
        if (d.kind === 'car') this.drawEntity(seg, d.c, d.c.z, d.c.x, CAR_WORLD_W, fogA, (ex, ey, ew) => drawCar(ctx, ex, ey, ew, d.c.color, d.c.kind, this.night));
        else if (d.kind === 'cop') {
          const c = d.c;
          this.drawEntity(seg, c, mod(c.d, L), c.x, BIKE_WORLD_W, fogA, (ex, ey, ew) =>
            drawRider(ctx, ex, ey, ew, { ...this.look(c, '#eef1f6', '#eef1f6'), jacket: '#1f3a7a', cop: true, time: g.clock, night: this.night }),
          );
        }
        else if (d.kind === 'rival') {
          const r = d.r;
          this.drawEntity(seg, r, mod(r.d, L), r.x, BIKE_WORLD_W, fogA, (ex, ey, ew) => drawRider(ctx, ex, ey, ew, { ...this.look(r, r.color, r.helmet), night: this.night }));
          if (r.visible && !r.down && r.sw > 18 && r.hp < 100) this.hpPip(r);
        }
      }
    }

    if (!playerDrawn) drawPlayer();

    this.speedLines(g.kmh(), dt);
    this.handleEvents(g);
    this.drawParticles(dt);
    ctx.restore();
    this.drawVignette();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(${g.flashColor},${g.flash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (g.phase === 'race' || g.phase === 'countdown' || g.phase === 'finished') this.hud(g);
    this.popups(g);
    if (g.phase === 'countdown') this.countdown(g);
    if (g.hint && g.phase === 'race') this.drawHint(g.hint.text, g.hint.t, g.hint.life);
  }

  /** Teaching hint in a dark pill, placed above the touch controls. */
  private drawHint(text: string, t: number, life: number) {
    const ctx = this.ctx;
    const { w, h } = this;
    const u = Math.min(w, h * 1.6) / 100;
    const size = Math.max(u * 2.6, 13 * (w / window.innerWidth));
    ctx.font = `700 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const maxW = w * 0.86;
    // Wrap to at most two lines.
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const wd of words) {
      const test = line ? `${line} ${wd}` : wd;
      if (ctx.measureText(test).width > maxW - size * 2 && line) {
        lines.push(line);
        line = wd;
      } else line = test;
    }
    lines.push(line);
    const bw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 2);
    const bh = lines.length * size * 1.35 + size * 0.9;
    const y = h > w ? h * 0.6 : h * 0.66;
    const a = Math.min(1, t * 5, (life - t) * 3);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(20,12,40,0.82)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, y - bh / 2, bw, bh, size * 0.6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,211,77,0.9)';
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y - ((lines.length - 1) * size * 1.35) / 2 + i * size * 1.35));
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  private minimap(g: Game, x: number, y: number, size: number) {
    const ctx = this.ctx;
    const map = g.track.map;
    const inset = size * 0.1;
    const s = size - inset * 2;
    ctx.fillStyle = 'rgba(15,10,35,0.45)';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * 0.12);
    ctx.fill();
    const px = (p: { x: number; y: number }) => x + inset + p.x * s;
    const py = (p: { x: number; y: number }) => y + inset + p.y * s;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(3, size * 0.06);
    ctx.beginPath();
    map.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p))));
    ctx.stroke();
    // Ridden part of the route.
    const done = Math.floor(Math.min(1, g.player.d / g.L) * (map.length - 1));
    ctx.strokeStyle = 'rgba(255,211,77,0.85)';
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.beginPath();
    for (let i = 0; i <= done; i++) (i ? ctx.lineTo(px(map[i]), py(map[i])) : ctx.moveTo(px(map[i]), py(map[i])));
    ctx.stroke();
    // Finish flag.
    const end = map[map.length - 1];
    const fs = Math.max(3, size * 0.045);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        ctx.fillRect(px(end) - fs + i * fs, py(end) - fs + j * fs, fs, fs);
      }
    // Riders.
    const dot = Math.max(2.5, size * 0.045);
    for (const r of g.rivals) {
      const m = g.track.mapAt(r.d);
      ctx.fillStyle = r.down ? 'rgba(255,255,255,0.4)' : r.color;
      ctx.beginPath();
      ctx.arc(px(m), py(m), dot, 0, Math.PI * 2);
      ctx.fill();
    }
    if (g.cop.active && !g.cop.down) {
      const m = g.track.mapAt(g.cop.d);
      ctx.fillStyle = Math.floor(g.clock * 6) % 2 ? '#ff3b3b' : '#4a7dff';
      ctx.beginPath();
      ctx.arc(px(m), py(m), dot * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const me = g.track.mapAt(g.player.d);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1d1438';
    ctx.lineWidth = Math.max(1.5, dot * 0.5);
    ctx.beginPath();
    ctx.arc(px(me), py(me), dot * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private weaponSlot(g: Game, x: number, y: number, u: number) {
    const p = g.player;
    const ctx = this.ctx;
    if (!p.weapon) {
      this.text('NO WEAPON', x, y + u * 2.4, u * 2, 'rgba(255,255,255,0.45)', 'left', 700);
      return;
    }
    const w = WEAPONS[p.weapon];
    ctx.fillStyle = 'rgba(15,10,35,0.5)';
    ctx.beginPath();
    ctx.roundRect(x, y, u * 22, u * 3.6, u * 0.8);
    ctx.fill();
    this.text(w.label, x + u * 1.2, y + u * 2.6, u * 2.4, '#7dff9a', 'left', 900);
    // One tick per swing left, placed after the measured label.
    ctx.font = `900 ${Math.round(u * 2.4)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const start = x + u * 2.2 + ctx.measureText(w.label).width;
    const tw = Math.min(u * 1.1, (x + u * 21 - start) / w.uses - u * 0.3);
    for (let i = 0; i < w.uses; i++) {
      ctx.fillStyle = i < p.weaponUses ? '#7dff9a' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(start + i * (tw + u * 0.3), y + u * 1.1, tw, u * 1.4);
    }
  }

  private look(r: Rider, bike: string, helmet: string): RiderLook {
    return {
      bike,
      jacket: bike,
      helmet,
      lean: r.lean,
      punch: r.punchT > 0 ? 1 - r.punchT / 0.18 : 0,
      kick: r.kickT > 0 ? 1 - r.kickT / 0.26 : 0,
      side: r.armSide,
      tumble: r.tumble,
      down: r.down,
      flash: r.flash,
      weapon: r.weapon,
      swing: r.swingT > 0 ? 1 - r.swingT / 0.28 : 0,
    };
  }

  private clipped(clipY: number, bottom: number, draw: () => void, fogA: number) {
    const ctx = this.ctx;
    const needClip = clipY < bottom;
    if (needClip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.w, clipY);
      ctx.clip();
    }
    ctx.globalAlpha = Math.max(0.15, 1 - fogA * 0.9);
    draw();
    ctx.globalAlpha = 1;
    if (needClip) ctx.restore();
  }

  private drawEntity(seg: Segment, e: ScreenPos, z: number, offset: number, worldW: number, fogA: number, draw: (x: number, y: number, w: number) => void) {
    const pct = (z % SEG_LEN) / SEG_LEN;
    const a = seg.p1.screen;
    const b = seg.p2.screen;
    const scale = lerp(a.scale, b.scale, pct);
    const sx = lerp(a.x, b.x, pct) + scale * offset * ROAD_W * this.kx;
    const sy = lerp(a.y, b.y, pct);
    const sw = worldW * scale * this.kx;
    e.sx = sx;
    e.sy = sy;
    e.sw = sw;
    e.visible = true;
    this.clipped(seg.clip, sy, () => draw(sx, sy, sw), fogA);
  }

  private hpPip(r: Rival) {
    const ctx = this.ctx;
    const bw = r.sw * 0.7;
    const y = r.sy - r.sw * 1.75;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.sx - bw / 2, y, bw, Math.max(3, r.sw * 0.06));
    ctx.fillStyle = r.hp > 40 ? '#ffd34d' : '#ff5a3c';
    ctx.fillRect(r.sx - bw / 2, y, (bw * Math.max(0, r.hp)) / 100, Math.max(3, r.sw * 0.06));
  }

  private drawSprite(sp: Sprite, x: number, y: number, w: number) {
    const ctx = this.ctx;
    const pick = SVG_SCENERY[this.def?.id ?? '']?.[sp.kind];
    const art = Array.isArray(pick) ? pick[Math.floor(sp.variant * pick.length * 7) % pick.length] : pick;
    if (art) {
      const a = ART[art];
      // Props share one scale (art px to world units), so the sheet's sizes hold.
      const dw = a.vw * PROP_SCALE * (w / SPRITE_W[sp.kind]);
      const k = dw / a.vw;
      const place = PROP_PLACE[art];
      const words = SIGN_WORDS[art];
      const shift = place?.ax === undefined ? 0 : (a.vw / 2 - place.ax) * k;
      const flip = words || place?.mirror === 'never' ? false : place?.mirror === 'road' ? sp.offset > 0 : sp.variant < 0.5;
      let ok: boolean;
      if (flip) {
        // Mirror around the ground point, so a pole stays where it stands.
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ok = svgArt.drawAt(ctx, art, shift, y, dw);
        ctx.restore();
      } else ok = svgArt.drawAt(ctx, art, x + shift, y, dw);
      if (ok) {
        if (words) this.signText(art, words, x + shift, y, dw, sp.variant);
        const g = PROP_GLOW[art];
        if (g && this.night) {
          const cx = x + (flip ? -1 : 1) * ((g[0] - a.vw / 2) * k + shift);
          this.propGlow(cx, y - (a.vh - g[1]) * k, g[2] * k);
        }
        return;
      }
    }
    const stamp = this.cache.get(sp.kind, sp.variant);
    if (stamp) {
      if (w < 1) return;
      const k = w / stamp.unit;
      const iw = stamp.img.width * k;
      const ih = stamp.img.height * k;
      ctx.drawImage(stamp.img, x - iw / 2, y - ih + 2 * k, iw, ih);
      return;
    }
    switch (sp.kind) {
      case 'palm':
        return drawPalm(ctx, x, y, w, sp.variant);
      case 'bush':
        return drawBush(ctx, x, y, w, sp.variant);
      case 'rock':
        return drawRock(ctx, x, y, w, sp.variant);
      case 'sign':
        return drawSign(ctx, x, y, w, sp.variant);
      case 'post':
        return drawPost(ctx, x, y, w);
      case 'arch':
        return drawArch(ctx, x, y, w);
      case 'cactus':
        return drawCactus(ctx, x, y, w, sp.variant);
      case 'pine':
        return drawPine(ctx, x, y, w, sp.variant);
      case 'building':
        return drawBuilding(ctx, x, y, w, sp.variant);
      case 'lamp':
        // The arm always reaches over the road.
        return drawLamp(ctx, x, y, w, sp.offset < 0 ? 0.9 : 0.1);
    }
  }

  /** Warm additive glow around a lamp head. */
  private propGlow(cx: number, cy: number, r: number) {
    if (r < 2) return;
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,215,140,0.55)');
    grad.addColorStop(1, 'rgba(255,215,140,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  /** Print the sign's words over its blank panels. Signs are never mirrored. */
  private signText(art: ArtName, words: string[][], x: number, y: number, dw: number, variant: number) {
    const a = ART[art];
    if (!a.panels) return;
    const k = dw / a.vw;
    const left = x - dw / 2;
    const top = y - a.vh * k;
    const ctx = this.ctx;
    a.panels.forEach((p, i) => {
      const list = words[i];
      if (!list) return;
      const pw = p.w * k;
      const ph = p.h * k;
      if (ph < 6) return;
      const text = list[Math.floor(variant * 997 + i * 3) % list.length];
      let size = ph * 0.62;
      ctx.font = `800 ${size}px ${HUD_FONT}`;
      const tw = ctx.measureText(text).width;
      if (tw > pw * 0.88) {
        size *= (pw * 0.88) / tw;
        ctx.font = `800 ${size}px ${HUD_FONT}`;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = SIGN_INK[art] ?? OUTLINE;
      ctx.fillText(text, left + (p.x + p.w / 2) * k, top + (p.y + p.h / 2) * k + size * 0.04);
    });
  }

  /** Sky color at height y, from the flat bands built for this track. */
  private bandAt(y: number) {
    const n = this.bands.length;
    const i = Math.max(0, Math.min(n - 1, Math.floor((y / (this.h * 0.5)) * n)));
    return this.bands[i] ?? '#000';
  }

  private drawSky(playerY: number) {
    const ctx = this.ctx;
    const { w, h } = this;
    const pal = this.def?.palette;
    if (!pal) return;

    // Flat horizontal bands, like 90s arcade skies. Bands thin out toward the horizon.
    const n = this.bands.length;
    const horizon = h * 0.5;
    for (let i = 0; i < n; i++) {
      const y0 = horizon * (1 - Math.pow(1 - i / n, 1.35));
      const y1 = i === n - 1 ? h * 0.66 : horizon * (1 - Math.pow(1 - (i + 1) / n, 1.35));
      ctx.fillStyle = this.bands[i];
      ctx.fillRect(0, Math.floor(y0), w, Math.ceil(y1 - y0) + 1);
    }

    if (pal.night) {
      for (const [x, y, b] of this.stars) {
        ctx.fillStyle = b > 0.7 ? '#ffffff' : 'rgba(255,255,255,0.55)';
        const sz = Math.max(1, Math.round((w / 900) * (1 + b)));
        ctx.fillRect(((x + this.skyOffset * 0.3) % 1) * w, y * h, sz, sz);
      }
    }

    // Sun or moon, drifting with the curves. Flat two-tone shapes, no glow.
    const sx = w * (0.5 + ((this.skyOffset * 3) % 1) - 0.5);
    const unit = Math.min(w, h * 1.4);
    const body = SKY_BODY[pal.sun];
    if (body && svgArt.drawAt(this.ctx, body.art, sx, h * body.y + unit * body.size * 0.5, unit * body.size)) {
      // Drawn from art.
    } else if (pal.sun === 'sun') {
      const sy = h * 0.4;
      const r = unit * 0.13;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#FFB347';
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      ctx.fillStyle = '#FFE08A';
      ctx.fillRect(sx - r, sy - r, r * 2, r * 0.9);
      // Horizontal cuts across the lower half show the sky through the sun.
      for (let k = 0; k < 4; k++) {
        const y = sy + r * (0.12 + k * 0.22);
        const t = r * (0.05 + k * 0.035);
        ctx.fillStyle = this.bandAt(y);
        ctx.fillRect(sx - r, y, r * 2, t);
      }
      ctx.restore();
    } else if (pal.sun === 'noon') {
      const sy = h * 0.14;
      const r = unit * 0.035;
      ctx.fillStyle = '#FFF0B0';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFDF0';
      ctx.beginPath();
      ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (pal.sun === 'pale') {
      const sy = h * 0.3;
      const r = unit * 0.06;
      ctx.fillStyle = 'rgba(255,250,232,0.55)';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF8E4';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const sy = h * 0.17;
      const r = unit * 0.045;
      ctx.fillStyle = '#E9E4CF';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBC4A8';
      for (const [dx, dy, rr] of [
        [-0.3, -0.2, 0.22],
        [0.25, 0.15, 0.3],
        [-0.15, 0.4, 0.14],
      ]) {
        ctx.beginPath();
        ctx.arc(sx + dx * r, sy + dy * r, rr * r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ridges with parallax, or a city skyline. Flat fills; the two nearer
    // layers get a dark outline along the top, like the rest of the art.
    const lift = playerY / 30000;
    const lw = Math.max(1.5, h / 380);
    this.ridges.forEach((pts, layer) => {
      const speed = [0.6, 1, 1.6][layer];
      const off = (this.skyOffset * speed) % 1;
      if (this.def && this.horizon(`horizon-${this.def.id}-${HORIZON_LAYERS[layer]}` as ArtName, off, h * 0.5 + lift * h * (layer + 1) * 0.03)) return;
      const baseY = h * (0.5 + layer * 0.025) + lift * h * (layer + 1) * 0.03;
      const amp = h * (0.16 - layer * 0.035);
      ctx.fillStyle = pal.ridges[layer];
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      const np = pts.length;
      if (pal.skyline) {
        // Blocks: one tower per point, with lit windows on the nearest layer.
        const cols = 24 + layer * 6;
        const bw = w / cols;
        const shift = off * bw * cols;
        for (let i = -1; i <= cols; i++) {
          const idx = (((i + Math.floor(shift / bw)) % np) + np) % np;
          const x = i * bw - (shift % bw);
          const top = Math.round(baseY - pts[idx] * amp * 1.3);
          ctx.fillStyle = pal.ridges[layer];
          ctx.fillRect(x, top, bw + 1, h - top);
          if (layer > 0) ctx.strokeRect(x, top, bw + 1, h - top);
          if (layer === 2 && bw > 12) {
            ctx.fillStyle = '#FFD77A';
            for (let yy = top + bw * 0.4; yy < baseY; yy += bw * 0.5)
              if ((idx * 7 + Math.floor(yy)) % 3 === 0) ctx.fillRect(x + bw * 0.3, yy, bw * 0.15, bw * 0.15);
          }
        }
        return;
      }
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i <= 32; i++) {
        const u = i / 32 + off;
        const f = (u * np) % np;
        const i0 = Math.floor(f);
        const v = lerp(pts[(i0 + np) % np], pts[(i0 + 1 + np) % np], f - i0);
        ctx.lineTo((i / 32) * w, baseY - v * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (layer > 0) ctx.stroke();
    });
  }

  /**
   * One horizon strip from art, tiled sideways and scrolled by `off` (a share
   * of the screen width), its bottom on `baseY`. Below it, a fill in the strip's
   * own ground color covers the gap hills can open. False if not ready.
   */
  private horizon(name: ArtName, off: number, baseY: number) {
    const a = ART[name];
    if (!a) return false;
    const { w, h, ctx } = this;
    // Capped by width too, so tall phone screens do not zoom into the strip.
    const dh = Math.min(h * HORIZON_H, Math.min(w, h * 1.4) * 0.34);
    const dw = (dh * a.vw) / a.vh;
    const c = svgArt.get(name, dh);
    const ground = svgArt.bottomColor(name);
    if (!c || !ground) return false;
    const y = Math.round(baseY - dh);
    let x = -mod(off * w, dw);
    for (; x < w; x += dw) ctx.drawImage(c, Math.floor(x), y, Math.ceil(dw) + 1, dh);
    ctx.fillStyle = ground;
    ctx.fillRect(0, y + dh - 1, w, h - (y + dh) + 1);
    return true;
  }

  private poly(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  private drawSegment(seg: Segment, fog: number, n: number) {
    const { w } = this;
    const a = seg.p1.screen;
    const b = seg.p2.screen;
    const k = seg.dark ? 1 : 0;
    const f = 1 - fog;
    const ctx = this.ctx;
    const C = this.C;
    if (!C) return;
    ctx.fillStyle = mix(C.ground[k], C.fog, f);
    ctx.fillRect(0, b.y, w, a.y - b.y);

    const r1 = a.w / 9;
    const r2 = b.w / 9;
    // Bottom edges overlap by 1px to hide anti-aliasing seams between segments.
    const ay = a.y + 1;
    // Worn shoulder just outside the kerb.
    const s1 = a.w * 0.16;
    const s2 = b.w * 0.16;
    const shoulderC = mix(C.ground[k].map((v) => v * 0.84) as RGB, C.fog, f);
    this.poly(a.x - a.w - r1 - s1, ay, a.x - a.w - r1, ay, b.x - b.w - r2, b.y, b.x - b.w - r2 - s2, b.y, shoulderC);
    this.poly(a.x + a.w + r1 + s1, ay, a.x + a.w + r1, ay, b.x + b.w + r2, b.y, b.x + b.w + r2 + s2, b.y, shoulderC);
    // Kerbs.
    this.poly(a.x - a.w - r1, ay, a.x - a.w, ay, b.x - b.w, b.y, b.x - b.w - r2, b.y, mix(C.rumble[k], C.fog, f));
    this.poly(a.x + a.w + r1, ay, a.x + a.w, ay, b.x + b.w, b.y, b.x + b.w + r2, b.y, mix(C.rumble[k], C.fog, f));
    // Tarmac.
    this.poly(a.x - a.w, ay, a.x + a.w, ay, b.x + b.w, b.y, b.x - b.w, b.y, seg.start ? mix(C.start, C.fog, f) : mix(C.road[k], C.fog, f));
    if (seg.start) return;

    const laneW1 = (a.w * 2) / LANES;
    const laneW2 = (b.w * 2) / LANES;

    // Darker wheel tracks in each lane, only up close where they read.
    if (n < 90) {
      ctx.fillStyle = `rgba(0,0,0,${0.09 * fog})`;
      for (let lane = 0; lane < LANES; lane++) {
        const c1 = a.x - a.w + laneW1 * (lane + 0.5);
        const c2 = b.x - b.w + laneW2 * (lane + 0.5);
        for (const o of [-0.22, 0.22]) {
          const t1 = laneW1 * 0.07;
          const t2 = laneW2 * 0.07;
          ctx.beginPath();
          ctx.moveTo(c1 + o * laneW1 - t1, ay);
          ctx.lineTo(c1 + o * laneW1 + t1, ay);
          ctx.lineTo(c2 + o * laneW2 + t2, b.y);
          ctx.lineTo(c2 + o * laneW2 - t2, b.y);
          ctx.fill();
        }
      }
    }

    // Solid edge lines.
    const e1 = a.w / 40;
    const e2 = b.w / 40;
    const edge = mix(C.lane, C.fog, f);
    const in1 = a.w * 0.04;
    const in2 = b.w * 0.04;
    this.poly(a.x - a.w + in1, a.y, a.x - a.w + in1 + e1, a.y, b.x - b.w + in2 + e2, b.y, b.x - b.w + in2, b.y, edge);
    this.poly(a.x + a.w - in1, a.y, a.x + a.w - in1 - e1, a.y, b.x + b.w - in2 - e2, b.y, b.x + b.w - in2, b.y, edge);

    // Dashed lane lines, with reflective studs at night.
    if (!seg.dark) {
      const l1 = a.w / 50;
      const l2 = b.w / 50;
      let lx1 = a.x - a.w + laneW1;
      let lx2 = b.x - b.w + laneW2;
      for (let lane = 1; lane < LANES; lane++, lx1 += laneW1, lx2 += laneW2) {
        this.poly(lx1 - l1 / 2, a.y, lx1 + l1 / 2, a.y, lx2 + l2 / 2, b.y, lx2 - l2 / 2, b.y, edge);
      }
    } else if (this.night && n < 160 && seg.index % 2 === 0) {
      const sz = Math.max(1, a.w / 70);
      ctx.fillStyle = `rgba(255,214,120,${0.9 * fog})`;
      let lx1 = a.x - a.w + laneW1;
      for (let lane = 1; lane < LANES; lane++, lx1 += laneW1) ctx.fillRect(lx1 - sz / 2, a.y - sz, sz, sz * 0.7);
    }
  }

  /** Warm pool of headlight on the road ahead, at night. */
  private headlight(py: number, pw: number) {
    const ctx = this.ctx;
    const cx = this.w / 2;
    const cy = py - pw * 1.5;
    const rx = pw * 2.4;
    const ry = pw * 1.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.scale(rx / ry, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, 'rgba(255,226,160,0.32)');
    g.addColorStop(0.6, 'rgba(255,226,160,0.12)');
    g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
    ctx.restore();
  }

  /** Darkened corners pull the eye to the road. Built once per screen size. */
  private drawVignette() {
    const { w, h } = this;
    if (!this.vignette || this.vignette.width !== w || this.vignette.height !== h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const v = c.getContext('2d');
      if (!v) return;
      const g = v.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(8,4,20,0.42)');
      v.fillStyle = g;
      v.fillRect(0, 0, w, h);
      this.vignette = c;
    }
    this.ctx.drawImage(this.vignette, 0, 0);
  }

  private speedLines(kmh: number, dt: number) {
    if (kmh < 185) return;
    const ctx = this.ctx;
    const { w, h } = this;
    const a = Math.min(0.55, (kmh - 185) / 80);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = Math.max(1, w / 600);
    const cx = w / 2;
    const cy = h * 0.45;
    const R = Math.hypot(w, h) / 2;
    ctx.beginPath();
    for (const l of this.lines) {
      l.r += dt * l.speed * 1.8;
      if (l.r > 1) {
        l.r = 0.35;
        l.a = Math.random() * Math.PI * 2;
      }
      const r0 = l.r * R;
      const r1 = (l.r + l.len) * R;
      ctx.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
      ctx.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
    }
    ctx.stroke();
  }

  private handleEvents(g: Game) {
    for (const e of g.events) {
      const at = e.kind === 'dust' ? g.player : e.at;
      const x = at.sx || this.w / 2;
      const y = (at.sy || this.h * 0.85) - (at.sw || this.w * 0.1) * (e.kind === 'dust' ? 0.2 : 1);
      const unit = Math.max(at.sw, this.w * 0.04);
      if (e.kind === 'spark' || e.kind === 'ko') {
        const n = e.kind === 'ko' ? 34 : 14;
        for (let i = 0; i < n; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = unit * (2 + Math.random() * (e.kind === 'ko' ? 7 : 4));
          this.parts.push({
            x,
            y,
            vx: Math.cos(ang) * sp - e.side * unit * 2,
            vy: Math.sin(ang) * sp - unit * 2,
            life: 0,
            max: 0.35 + Math.random() * 0.35,
            size: unit * (0.04 + Math.random() * 0.06),
            color: i % 3 ? '#ffd34d' : '#ffffff',
          });
        }
      } else if (e.kind === 'dust') {
        for (let i = 0; i < 26; i++) {
          this.parts.push({
            x: x + (Math.random() - 0.5) * unit,
            y,
            vx: (Math.random() - 0.5) * unit * 6,
            vy: -Math.random() * unit * 3,
            life: 0,
            max: 0.6 + Math.random() * 0.5,
            size: unit * (0.06 + Math.random() * 0.1),
            color: 'rgba(225,205,170,0.55)',
            round: true,
          });
        }
      } else if (e.kind === 'cash') {
        this.parts.push({ x, y: y - unit * 0.5, vx: 0, vy: -unit * 1.5, life: 0, max: 1, size: unit * 0.35, color: '#7dff9a', text: '$' });
      }
    }
    g.events.length = 0;
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.round ? this.h * 0.1 : this.h * 1.2) * dt;
      const a = 1 - p.life / p.max;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.text) {
        ctx.font = `900 ${Math.round(p.size)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.round) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.life * 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sparks glow: additive blend and a short streak along their motion.
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life < p.max);
  }

  private text(t: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', weight = 800) {
    const ctx = this.ctx;
    ctx.font = `${weight >= 900 ? 'italic ' : ''}${weight} ${Math.round(size)}px ${HUD_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = size * 0.14;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,6,24,0.7)';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  }

  private hud(g: Game) {
    const ctx = this.ctx;
    const { w, h } = this;
    const u = Math.min(w, h * 1.6) / 100;
    const pad = u * 2.5;
    const total = 1 + g.rivals.length;

    // Angled plates behind place and speed keep them readable on any sky.
    this.plate(0, 0, u * 30, pad + u * 12.6);
    this.plate(w - u * 30, 0, u * 30, pad + u * 12.6, true);

    // Place.
    const place = g.place();
    this.text(ordinal(place), pad, pad + u * 7, u * 8, place === 1 ? '#ffd34d' : '#fff', 'left', 900);
    this.text(`/ ${total}`, pad + u * 13.5, pad + u * 7, u * 3.5, 'rgba(255,255,255,0.8)');
    this.text(formatTime(g.raceTime), pad, pad + u * 11.5, u * 3, 'rgba(255,255,255,0.9)', 'left', 700);

    // Speed.
    this.text(`${g.kmh()}`, w - pad - u * 7, pad + u * 7, u * 8, '#fff', 'right', 900);
    this.text('km/h', w - pad, pad + u * 7, u * 2.6, 'rgba(255,255,255,0.8)', 'right', 700);
    this.text(`$${g.score.toLocaleString()}`, w - pad, pad + u * 11.5, u * 3, '#7dff9a', 'right', 800);

    // Health.
    const hw = u * 22;
    const hy = pad + u * 14;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(pad, hy, hw, u * 1.6);
    const hp = Math.max(0, g.player.hp) / g.player.hpMax;
    ctx.fillStyle = hp > 0.4 ? '#4fe07a' : '#ff5a3c';
    ctx.fillRect(pad, hy, hw * hp, u * 1.6);
    // Segment ticks.
    ctx.fillStyle = 'rgba(10,6,24,0.6)';
    for (let i = 1; i < 10; i++) ctx.fillRect(pad + (hw * i) / 10 - 1, hy, 2, u * 1.6);

    this.weaponSlot(g, pad, hy + u * 2.6, u);

    // Police warning while they chase from behind.
    const cop = g.cop;
    const copGap = cop.d - g.player.d;
    if (cop.active && !cop.down && copGap < -250 && copGap > -6000 && g.phase === 'race') {
      const blink = Math.floor(g.clock * 4) % 2 === 0;
      this.text(`POLICE ${Math.round(-copGap / 20)} m behind`, w / 2, h * 0.2, u * 2.8, blink ? '#7fb8ff' : '#ff6b6b', 'center', 900);
    }
    const ms = Math.min(u * 20, h * 0.2);
    this.minimap(g, w - pad - ms, pad + u * 13.5, ms);

    // Progress along the race.
    const bx = w * 0.3;
    const bw = w * 0.4;
    const by = pad + u * 1;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, bw, u * 0.9);
    for (const r of g.rivals) {
      const t = Math.min(1, r.d / g.L);
      ctx.fillStyle = r.color;
      ctx.fillRect(bx + bw * t - u * 0.4, by - u * 0.4, u * 0.8, u * 1.7);
    }
    const pt = Math.min(1, g.player.d / g.L);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bx + bw * pt, by + u * 0.45, u * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Combo.
    if (g.combo > 1 && g.comboT > 0) {
      const cy = h * 0.27;
      const pulse = 1 + Math.max(0, g.comboT - 2.3) * 0.8;
      this.text(`x${g.combo}`, w / 2, cy, u * 7 * pulse, '#ffd34d', 'center', 900);
      this.text('COMBO', w / 2, cy + u * 3.2, u * 2.4, '#fff', 'center', 800);
      ctx.fillStyle = 'rgba(255,211,77,0.8)';
      const cw = u * 14 * (g.comboT / 2.6);
      ctx.fillRect(w / 2 - cw / 2, cy + u * 4.2, cw, u * 0.6);
    }
  }

  private plate(x: number, y: number, pw: number, ph: number, right = false) {
    const ctx = this.ctx;
    const slant = ph * 0.35;
    const g = ctx.createLinearGradient(x, 0, x + pw, 0);
    g.addColorStop(right ? 1 : 0, 'rgba(10,6,24,0.62)');
    g.addColorStop(right ? 0 : 1, 'rgba(10,6,24,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (right) {
      ctx.moveTo(x + slant, y);
      ctx.lineTo(x + pw, y);
      ctx.lineTo(x + pw, y + ph);
      ctx.lineTo(x, y + ph);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + pw, y);
      ctx.lineTo(x + pw - slant, y + ph);
      ctx.lineTo(x, y + ph);
    }
    ctx.closePath();
    ctx.fill();
  }

  private popups(g: Game) {
    const { w, h } = this;
    const u = Math.min(w, h * 1.6) / 100;
    let smallY = h * 0.62;
    for (const p of g.popups) {
      const k = p.t / p.life;
      const pop = p.t < 0.12 ? 0.6 + (p.t / 0.12) * 0.6 : p.t < 0.22 ? 1.2 - ((p.t - 0.12) / 0.1) * 0.2 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      this.ctx.globalAlpha = a;
      if (p.big) {
        this.text(p.text, w / 2, h * 0.42, u * 10 * pop, p.color, 'center', 900);
        if (p.sub) this.text(p.sub, w / 2, h * 0.42 + u * 5.5, u * 3.4, '#fff', 'center', 800);
      } else {
        this.text(p.text, w / 2, smallY - k * u * 4, u * 3.6 * pop, p.color, 'center', 900);
        smallY -= u * 5;
      }
      this.ctx.globalAlpha = 1;
    }
  }

  private countdown(g: Game) {
    const { w, h } = this;
    const u = Math.min(w, h * 1.6) / 100;
    const n = Math.ceil(g.countdown);
    const frac = g.countdown - Math.floor(g.countdown);
    this.text(String(n), w / 2, h * 0.45, u * (14 + frac * 10), '#fff', 'center', 900);
  }
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
