// High-detail scenery, drawn once into small offscreen canvases and stamped
// every frame. Gradients, shading and outlines would be too slow to draw live
// for 100+ sprites a frame; stamping a cached image is cheap.

import type { SpriteKind } from './track';

type Ctx = CanvasRenderingContext2D;

/** Pixels per nominal sprite width in the cache. */
const B = 160;
const VARIANTS = 6;

interface Spec {
  /** Canvas size as multiples of the nominal width. */
  sx: number;
  sy: number;
  draw: (ctx: Ctx, cx: number, by: number, w: number, v: number) => void;
}

export interface Stamp {
  img: HTMLCanvasElement;
  /** Width of the nominal sprite inside the image, in image pixels. */
  unit: number;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const rand = (seed: number) => {
  let s = Math.floor(seed * 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

// ---------------------------------------------------------------------------
// Scenery drawings. Origin bottom center, `w` is the nominal width.
// ---------------------------------------------------------------------------

function palm(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const r = rand(v);
  const h = w * (2.3 + v * 0.7);
  const lean = (v - 0.5) * w * 0.7;
  const tx = cx + lean;
  const ty = by - h;
  // Trunk: tapered, shaded, with growth rings.
  const g = ctx.createLinearGradient(cx - w * 0.1, 0, cx + w * 0.1, 0);
  g.addColorStop(0, '#5a3d25');
  g.addColorStop(0.45, '#9b7350');
  g.addColorStop(1, '#4a321f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.07, by);
  ctx.quadraticCurveTo(cx + lean * 0.15 - w * 0.06, by - h * 0.55, tx - w * 0.035, ty);
  ctx.lineTo(tx + w * 0.035, ty);
  ctx.quadraticCurveTo(cx + lean * 0.15 + w * 0.06, by - h * 0.55, cx + w * 0.07, by);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,25,12,0.45)';
  ctx.lineWidth = w * 0.012;
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const x = cx + (tx - cx) * t * t * 0.9 + lean * 0.08 * t;
    const y = by - h * t;
    const hw = w * (0.07 - t * 0.035);
    ctx.beginPath();
    ctx.moveTo(x - hw, y + w * 0.01);
    ctx.quadraticCurveTo(x, y - w * 0.015, x + hw, y + w * 0.01);
    ctx.stroke();
  }
  // Fronds: two-tone leaves arching out and down.
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + r() * 0.4;
    const len = w * (0.72 + r() * 0.25);
    const dx = Math.cos(a) * len;
    const droop = w * (0.18 + Math.max(0, Math.sin(a)) * 0.35);
    const ex = tx + dx;
    const ey = ty + droop + Math.sin(a) * w * 0.12;
    const mx = tx + dx * 0.5;
    const my = ty - w * 0.22 + Math.sin(a) * w * 0.05;
    const back = Math.sin(a) < 0;
    ctx.fillStyle = back ? '#1f5a30' : i % 2 ? '#2f7d43' : '#3a9150';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my - w * 0.06, ex, ey);
    ctx.quadraticCurveTo(mx, my + w * 0.08, tx, ty + w * 0.02);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,170,0.35)';
    ctx.lineWidth = w * 0.01;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  // Coconuts.
  ctx.fillStyle = '#4d3520';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(tx + (i - 1) * w * 0.05, ty + w * 0.05, w * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pine(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const h = w * (2.2 + v * 1.0);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(cx - w * 0.05, by - h * 0.22, w * 0.1, h * 0.22);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers;
    const tw = w * (0.58 - f * 0.1);
    const base = by - h * (0.14 + f * 0.17);
    const top = base - h * 0.32;
    // Lit left half, shaded right half.
    ctx.fillStyle = '#2c6b45';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, base + w * 0.04);
    ctx.lineTo(cx - tw, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a4630';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + tw, base);
    ctx.lineTo(cx, base + w * 0.04);
    ctx.closePath();
    ctx.fill();
    // Ragged edge.
    ctx.fillStyle = '#163d29';
    for (let k = 0; k < 6; k++) {
      const x = cx - tw + (k / 5) * tw * 2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.04, base - w * 0.01);
      ctx.lineTo(x, base + w * 0.05);
      ctx.lineTo(x + w * 0.04, base - w * 0.01);
      ctx.fill();
    }
  }
}

function rock(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const r = rand(v);
  const h = w * (0.5 + v * 0.3);
  const pts: Array<[number, number]> = [
    [-0.5, 0],
    [-0.42, -0.45],
    [-0.15 + r() * 0.1, -1],
    [0.2, -0.85],
    [0.45, -0.4],
    [0.5, 0],
  ];
  const P = pts.map(([x, y]) => [cx + x * w, by + y * h] as const);
  ctx.fillStyle = '#9a8d7c';
  ctx.beginPath();
  P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  // Facets: lit top-left, dark right.
  ctx.fillStyle = '#b5a894';
  ctx.beginPath();
  ctx.moveTo(P[1][0], P[1][1]);
  ctx.lineTo(P[2][0], P[2][1]);
  ctx.lineTo(cx, by - h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6f6455';
  ctx.beginPath();
  ctx.moveTo(P[3][0], P[3][1]);
  ctx.lineTo(P[4][0], P[4][1]);
  ctx.lineTo(P[5][0], P[5][1]);
  ctx.lineTo(cx + w * 0.05, by);
  ctx.lineTo(cx, by - h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,32,24,0.5)';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath();
  P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function bush(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const r = rand(v);
  const blobs = 6;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < blobs; i++) {
      const x = cx + (i / (blobs - 1) - 0.5) * w * 0.7 + (r() - 0.5) * w * 0.1;
      const rad = w * (0.18 + r() * 0.1);
      const y = by - rad * (0.8 + Math.sin((i / (blobs - 1)) * Math.PI) * 0.7);
      const g = ctx.createRadialGradient(x - rad * 0.4, y - rad * 0.5, rad * 0.1, x, y, rad);
      g.addColorStop(0, pass ? '#8cc260' : '#5d8a3c');
      g.addColorStop(1, pass ? '#3f6b2b' : '#2f5220');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad * (pass ? 0.8 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function cactus(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const h = w * (1.5 + v * 0.8);
  const t = w * 0.24;
  const arm = (x: number, y: number, aw: number, ah: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * aw, y);
    ctx.quadraticCurveTo(x + dir * (aw + t * 0.5), y, x + dir * (aw + t * 0.5), y - t * 0.5);
    ctx.lineTo(x + dir * (aw + t * 0.5), y - ah);
    ctx.lineWidth = t * 0.8;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const g = ctx.createLinearGradient(cx - t, 0, cx + t, 0);
  g.addColorStop(0, '#76a85a');
  g.addColorStop(0.5, '#4f7f3f');
  g.addColorStop(1, '#32562a');
  ctx.strokeStyle = g;
  arm(cx, by - h * 0.45, w * 0.28, h * 0.3, -1);
  arm(cx, by - h * 0.6, w * 0.22, h * 0.26, 1);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(cx - t / 2, by - h, t, h, t / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,40,15,0.35)';
  ctx.lineWidth = w * 0.012;
  for (const dx of [-0.25, 0, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * t, by - h + t * 0.4);
    ctx.lineTo(cx + dx * t, by);
    ctx.stroke();
  }
  if (v > 0.6) {
    ctx.fillStyle = '#ff7aa8';
    ctx.beginPath();
    ctx.arc(cx, by - h + t * 0.15, t * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

const TOWER = ['#1b1f3a', '#232848', '#2b2242', '#18233a', '#20203a', '#272e4a'];

function building(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const r = rand(v);
  const h = w * (1.8 + v * 2.6);
  const x0 = cx - w / 2;
  const base = TOWER[Math.floor(v * TOWER.length) % TOWER.length];
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, base);
  g.addColorStop(1, '#0c0e1d');
  ctx.fillStyle = g;
  ctx.fillRect(x0, by - h, w, h);
  // Side face for depth.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x0 + w * 0.82, by - h, w * 0.18, h);
  // Windows.
  const cols = 5;
  const rows = Math.max(4, Math.floor(h / (w / 4)));
  const cw = (w * 0.82) / cols;
  const ch = h / rows;
  for (let rr = 0; rr < rows - 1; rr++)
    for (let c = 0; c < cols; c++) {
      const k = r();
      if (k < 0.32) continue;
      ctx.fillStyle = k > 0.92 ? '#9fe3ff' : k > 0.6 ? '#ffd77a' : '#c99a4a';
      ctx.globalAlpha = 0.55 + k * 0.45;
      ctx.fillRect(x0 + c * cw + cw * 0.22, by - h + rr * ch + ch * 0.28, cw * 0.56, ch * 0.44);
    }
  ctx.globalAlpha = 1;
  // Roof: water tank or antenna.
  ctx.fillStyle = '#0c0e1d';
  if (v < 0.5) ctx.fillRect(cx - w * 0.12, by - h - w * 0.18, w * 0.24, w * 0.18);
  else {
    ctx.fillRect(cx - w * 0.01, by - h - w * 0.5, w * 0.02, w * 0.5);
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(cx, by - h - w * 0.5, w * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  // Neon strip.
  if (v > 0.55) {
    ctx.shadowBlur = w * 0.08;
    ctx.shadowColor = v > 0.8 ? '#ff4fa3' : '#43e8ff';
    ctx.fillStyle = v > 0.8 ? '#ff7cc0' : '#7af0ff';
    ctx.fillRect(x0 + w * 0.05, by - h * 0.9, w * 0.72, w * 0.035);
    ctx.shadowBlur = 0;
  }
}

const SIGNS = ['FUEL 24/7', 'MOTEL', 'SURF SHOP', 'DINER', 'TACOS', 'COLD DRINKS'];

function sign(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  const sw = w;
  const sh = w * 0.48;
  const top = by - w * 1.1;
  ctx.fillStyle = '#3b3f48';
  ctx.fillRect(cx - sw * 0.34, top + sh, w * 0.05, by - top - sh);
  ctx.fillRect(cx + sw * 0.29, top + sh, w * 0.05, by - top - sh);
  ctx.fillStyle = '#2a2d34';
  ctx.fillRect(cx - sw * 0.5, top + sh, sw, w * 0.03);
  const light = v > 0.5;
  const g = ctx.createLinearGradient(0, top, 0, top + sh);
  g.addColorStop(0, light ? '#fbefcf' : '#28507d');
  g.addColorStop(1, light ? '#e3cfa2' : '#1b3557');
  ctx.fillStyle = g;
  ctx.fillRect(cx - sw / 2, top, sw, sh);
  ctx.strokeStyle = '#121418';
  ctx.lineWidth = w * 0.025;
  ctx.strokeRect(cx - sw / 2, top, sw, sh);
  ctx.fillStyle = light ? '#c0392b' : '#ffd34d';
  ctx.font = `900 ${Math.round(w * 0.16)}px "Saira Condensed", "Arial Narrow", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SIGNS[Math.floor(v * SIGNS.length) % SIGNS.length], cx, top + sh / 2);
  // Lamps along the top.
  ctx.fillStyle = '#2a2d34';
  for (const x of [-0.3, 0, 0.3]) ctx.fillRect(cx + x * sw - w * 0.02, top - w * 0.06, w * 0.04, w * 0.06);
}

const SPECS: Partial<Record<SpriteKind, Spec>> = {
  palm: { sx: 2.4, sy: 3.4, draw: palm },
  pine: { sx: 1.4, sy: 3.4, draw: pine },
  rock: { sx: 1.1, sy: 0.9, draw: rock },
  bush: { sx: 1.2, sy: 0.75, draw: bush },
  cactus: { sx: 1.2, sy: 2.4, draw: cactus },
  building: { sx: 1.1, sy: 5.2, draw: building },
  sign: { sx: 1.1, sy: 1.25, draw: sign },
};

export class SpriteCache {
  private stamps = new Map<string, Stamp>();

  has(kind: SpriteKind) {
    return kind in SPECS;
  }

  get(kind: SpriteKind, variant: number): Stamp | null {
    const spec = SPECS[kind];
    if (!spec) return null;
    const b = Math.min(VARIANTS - 1, Math.floor(variant * VARIANTS));
    const key = `${kind}:${b}`;
    let s = this.stamps.get(key);
    if (!s) {
      const img = makeCanvas(B * spec.sx, B * spec.sy);
      const ctx = img.getContext('2d');
      if (!ctx) return null;
      spec.draw(ctx, img.width / 2, img.height - 2, B, (b + 0.5) / VARIANTS);
      s = { img, unit: B };
      this.stamps.set(key, s);
    }
    return s;
  }

  /** Build every variant of these kinds now, so a race never stutters on a new sprite. */
  prewarm(kinds: SpriteKind[]) {
    for (const k of kinds) for (let b = 0; b < VARIANTS; b++) this.get(k, (b + 0.5) / VARIANTS);
  }

  /** Long, flat cloud bands tinted to the sky. `tint` is an "r,g,b" string. */
  cloud(i: number, tint = '255,255,255'): HTMLCanvasElement {
    const key = `cloud:${i}:${tint}`;
    const hit = this.stamps.get(key);
    if (hit) return hit.img;
    const img = makeCanvas(480, 90);
    const ctx = img.getContext('2d');
    if (ctx) {
      const r = rand((i + 1) / 7);
      // Squash round puffs into long bands, brighter on top.
      ctx.scale(1, 0.45);
      for (let k = 0; k < 14; k++) {
        const x = 50 + r() * 380;
        const y = 120 - Math.sin(((x - 50) / 380) * Math.PI) * 40 + r() * 20;
        const rad = 22 + r() * 34;
        const g = ctx.createRadialGradient(x, y - rad * 0.4, rad * 0.1, x, y, rad);
        g.addColorStop(0, `rgba(${tint},0.9)`);
        g.addColorStop(0.55, `rgba(${tint},0.45)`);
        g.addColorStop(1, `rgba(${tint},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.stamps.set(key, { img, unit: 480 });
    return img;
  }
}
