// Procedural sprites. Every function draws with its origin at bottom center,
// in a box `w` pixels wide. No image files: the whole game stays tiny.

type Ctx = CanvasRenderingContext2D;

export interface RiderLook {
  bike: string;
  jacket: string;
  helmet: string;
  lean: number;
  punch: number; // 0..1 progress, 0 = idle
  kick: number;
  side: number; // -1 left, 1 right
  tumble: number; // radians, 0 = upright
  down: boolean;
  flash: number;
  player?: boolean;
  weapon?: 'club' | 'chain' | null;
  swing?: number; // 0..1 progress of a weapon swing, 0 = idle
  /** Police: light bar on the tail, flashing by `time`. */
  cop?: boolean;
  time?: number;
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function drawRider(ctx: Ctx, cx: number, by: number, w: number, o: RiderLook) {
  if (w < 1.5) return;
  ctx.save();
  ctx.translate(cx, by);

  // Shadow stays flat on the road.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.45, w * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(w, w);
  if (o.down) {
    ctx.translate(0, -0.35);
    ctx.rotate(o.tumble);
    ctx.translate(0, 0.35);
  } else {
    ctx.rotate(o.lean);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Rear tyre.
  ctx.fillStyle = '#121212';
  rr(ctx, -0.12, -0.44, 0.24, 0.44, 0.08);
  ctx.fillStyle = '#2a2a2a';
  rr(ctx, -0.06, -0.4, 0.12, 0.36, 0.05);

  // Exhaust.
  ctx.fillStyle = '#8a8f96';
  rr(ctx, 0.14, -0.36, 0.12, 0.07, 0.03);

  // Tail fairing.
  ctx.fillStyle = o.bike;
  ctx.beginPath();
  ctx.moveTo(-0.3, -0.42);
  ctx.lineTo(0.3, -0.42);
  ctx.lineTo(0.22, -0.7);
  ctx.lineTo(-0.22, -0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-0.3, -0.47, 0.6, 0.05);
  // Tail light.
  ctx.fillStyle = '#ff2a2a';
  rr(ctx, -0.11, -0.58, 0.22, 0.06, 0.02);
  if (o.cop) {
    // Light bar: alternating red and blue, with a glow.
    const on = Math.floor((o.time ?? 0) * 8) % 2 === 0;
    ctx.fillStyle = '#e8ecf2';
    rr(ctx, -0.26, -0.78, 0.52, 0.07, 0.02);
    ctx.shadowBlur = w * 0.18;
    ctx.shadowColor = on ? '#ff2a2a' : '#2a7bff';
    ctx.fillStyle = on ? '#ff3b3b' : '#4a7dff';
    rr(ctx, -0.26, -0.84, 0.24, 0.08, 0.03);
    ctx.fillStyle = on ? '#4a7dff' : '#ff3b3b';
    rr(ctx, 0.02, -0.84, 0.24, 0.08, 0.03);
    ctx.shadowBlur = 0;
  }

  // Legs.
  ctx.strokeStyle = '#23262d';
  ctx.lineWidth = 0.12;
  const kick = Math.sin(Math.min(1, o.kick) * Math.PI);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.14, -0.74);
    if (kick > 0 && s === o.side) {
      ctx.lineTo(s * (0.3 + kick * 0.45), -0.66 + kick * 0.05);
      ctx.lineTo(s * (0.38 + kick * 0.62), -0.62 + kick * 0.08);
    } else {
      ctx.lineTo(s * 0.3, -0.58);
      ctx.lineTo(s * 0.27, -0.42);
    }
    ctx.stroke();
  }
  // Boots.
  ctx.fillStyle = '#0d0d0d';
  for (const s of [-1, 1]) {
    if (kick > 0 && s === o.side) {
      ctx.beginPath();
      ctx.arc(s * (0.4 + kick * 0.62), -0.6 + kick * 0.08, 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else {
      rr(ctx, s * 0.27 - 0.06, -0.46, 0.12, 0.09, 0.03);
    }
  }

  // Torso, leaning forward.
  ctx.fillStyle = o.jacket;
  rr(ctx, -0.22, -1.2, 0.44, 0.52, 0.14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, -0.04, -1.16, 0.08, 0.44, 0.04);

  // Arms.
  const punch = Math.sin(Math.min(1, o.punch) * Math.PI);
  ctx.strokeStyle = o.jacket;
  ctx.lineWidth = 0.1;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.19, -1.1);
    if (punch > 0 && s === o.side) {
      ctx.lineTo(s * (0.4 + punch * 0.25), -1.08);
      ctx.lineTo(s * (0.55 + punch * 0.4), -1.04);
    } else {
      ctx.lineTo(s * 0.32, -0.95);
      ctx.lineTo(s * 0.34, -0.8);
    }
    ctx.stroke();
  }
  // Gloves.
  ctx.fillStyle = '#111';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (punch > 0 && s === o.side) ctx.arc(s * (0.57 + punch * 0.42), -1.04, 0.075, 0, Math.PI * 2);
    else ctx.arc(s * 0.34, -0.79, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.weapon) drawHeldWeapon(ctx, o.weapon, o.side, o.swing ?? 0);

  // Helmet.
  ctx.fillStyle = o.helmet;
  ctx.beginPath();
  ctx.arc(0, -1.32, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(0, -1.32, 0.16, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.fill();
  if (o.player) {
    ctx.fillStyle = '#fff';
    rr(ctx, -0.03, -1.48, 0.06, 0.3, 0.02);
  }

  if (o.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, o.flash)})`;
    ctx.fillRect(-1, -1.6, 2, 1.7);
  }
  ctx.restore();
}

/** Weapon in the rider's hand on `side`. Idle it rests up and out; a swing sweeps it across. */
function drawHeldWeapon(ctx: Ctx, kind: 'club' | 'chain', side: number, swing: number) {
  const s = side || 1;
  const hx = s * 0.36;
  const hy = -0.86;
  // Angle from straight up: idle leans out, a swing sweeps far out to the side.
  const k = swing > 0 ? Math.sin(Math.min(1, swing) * Math.PI) : 0;
  const ang = s * (0.35 + k * 1.5);
  const len = kind === 'club' ? 0.62 : 0.7;
  const tx = hx + Math.sin(ang) * len;
  const ty = hy - Math.cos(ang) * len;
  ctx.save();
  if (kind === 'club') {
    ctx.strokeStyle = '#6b4424';
    ctx.lineWidth = 0.075;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = '#4e2f17';
    ctx.beginPath();
    ctx.arc(tx, ty, 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#c9ced6';
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      // The chain sags a little when idle.
      const sag = (1 - k) * Math.sin(f * Math.PI) * 0.08 * s;
      ctx.beginPath();
      ctx.arc(hx + (tx - hx) * f + sag, hy + (ty - hy) * f, 0.034, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawCar(ctx: Ctx, cx: number, by: number, w: number, color: string, kind: number, night = false) {
  if (w < 2) return;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(w, w);
  const h = kind === 2 ? 0.78 : kind === 1 ? 0.6 : 0.52;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.55, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#111';
  rr(ctx, -0.46, -0.14, 0.16, 0.14, 0.03);
  rr(ctx, 0.3, -0.14, 0.16, 0.14, 0.03);
  // Body.
  ctx.fillStyle = color;
  rr(ctx, -0.5, -h * 0.62, 1, h * 0.5, 0.06);
  // Cabin.
  ctx.beginPath();
  ctx.moveTo(-0.4, -h * 0.6);
  ctx.lineTo(-0.32, -h);
  ctx.lineTo(0.32, -h);
  ctx.lineTo(0.4, -h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.beginPath();
  ctx.moveTo(-0.34, -h * 0.64);
  ctx.lineTo(-0.28, -h * 0.94);
  ctx.lineTo(0.28, -h * 0.94);
  ctx.lineTo(0.34, -h * 0.64);
  ctx.closePath();
  ctx.fill();
  // Lights and plate. At night the tail lights glow.
  if (night) {
    ctx.shadowBlur = w * 0.12;
    ctx.shadowColor = '#ff2020';
  }
  ctx.fillStyle = '#ff3030';
  rr(ctx, -0.46, -h * 0.5, 0.16, 0.07, 0.02);
  rr(ctx, 0.3, -h * 0.5, 0.16, 0.07, 0.02);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f2f2e6';
  ctx.fillRect(-0.1, -h * 0.34, 0.2, 0.07);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-0.5, -h * 0.18, 1, 0.05);
  ctx.restore();
}

export function drawPalm(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  const h = w * (2 + v * 0.8);
  const bend = (v - 0.5) * w * 0.5;
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, by);
  ctx.quadraticCurveTo(cx + bend * 0.2, by - h * 0.5, cx + bend, by - h);
  ctx.stroke();
  const tx = cx + bend;
  const ty = by - h;
  ctx.fillStyle = v > 0.5 ? '#2f7d43' : '#3b8c4a';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + v;
    const lx = Math.cos(a) * w * 0.65;
    const ly = Math.sin(a) * w * 0.25 + w * 0.12;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + lx * 0.5, ty - w * 0.25, tx + lx, ty + ly);
    ctx.quadraticCurveTo(tx + lx * 0.5, ty - w * 0.08, tx, ty);
    ctx.fill();
  }
}

export function drawBush(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  ctx.fillStyle = v > 0.5 ? '#4b7d3a' : '#5d8a3c';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + (i - 1) * w * 0.28, by - w * 0.22, w * (0.26 + (i === 1 ? 0.06 : 0)), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawRock(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  ctx.fillStyle = v > 0.5 ? '#8d8172' : '#9c8e7c';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, by);
  ctx.lineTo(cx - w * 0.38, by - w * 0.4);
  ctx.lineTo(cx - w * 0.05, by - w * (0.6 + v * 0.2));
  ctx.lineTo(cx + w * 0.35, by - w * 0.42);
  ctx.lineTo(cx + w * 0.5, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, by - w * (0.6 + v * 0.2));
  ctx.lineTo(cx + w * 0.35, by - w * 0.42);
  ctx.lineTo(cx + w * 0.5, by);
  ctx.lineTo(cx + w * 0.05, by);
  ctx.closePath();
  ctx.fill();
}

const SIGNS = ['FUEL 24/7', 'MOTEL', 'SURF SHOP', 'DINER', 'TACOS', 'COLD DRINKS'];

export function drawSign(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 2) return;
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - w * 0.36, by - w * 0.6, w * 0.05, w * 0.6);
  ctx.fillRect(cx + w * 0.31, by - w * 0.6, w * 0.05, w * 0.6);
  ctx.fillStyle = v > 0.5 ? '#f4e2b8' : '#1f3b5c';
  ctx.fillRect(cx - w * 0.5, by - w * 1.05, w, w * 0.48);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.strokeRect(cx - w * 0.5, by - w * 1.05, w, w * 0.48);
  if (w > 24) {
    ctx.fillStyle = v > 0.5 ? '#c0392b' : '#ffd34d';
    ctx.font = `900 ${Math.round(w * 0.15)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGNS[Math.floor(v * SIGNS.length)], cx, by - w * 0.81);
  }
}

export function drawPost(ctx: Ctx, cx: number, by: number, w: number) {
  if (w < 1) return;
  ctx.fillStyle = '#eee';
  ctx.fillRect(cx - w * 0.5, by - w * 4, w, w * 4);
  ctx.fillStyle = '#e8452c';
  ctx.fillRect(cx - w * 0.5, by - w * 3.6, w, w * 0.6);
}

export function drawArch(ctx: Ctx, cx: number, by: number, w: number) {
  if (w < 4) return;
  const pw = w * 0.025;
  const h = w * 0.32;
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - w / 2, by - h, pw, h);
  ctx.fillRect(cx + w / 2 - pw, by - h, pw, h);
  const bh = w * 0.06;
  const cells = 24;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(cx - w / 2 + (i * w) / cells, by - h - bh + (j * bh) / 2, w / cells + 0.5, bh / 2 + 0.5);
    }
  }
}

export function drawCactus(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  const h = w * (1.4 + v * 0.8);
  const t = w * 0.22;
  ctx.fillStyle = v > 0.5 ? '#4f7f3f' : '#5b8c45';
  rr(ctx, cx - t / 2, by - h, t, h, t / 2);
  // Arms.
  rr(ctx, cx - w * 0.42, by - h * 0.62, t * 0.8, h * 0.32, t / 2);
  rr(ctx, cx - w * 0.42, by - h * 0.38, w * 0.3, t * 0.8, t / 2);
  rr(ctx, cx + w * 0.22, by - h * 0.78, t * 0.8, h * 0.3, t / 2);
  rr(ctx, cx + t * 0.3, by - h * 0.55, w * 0.3, t * 0.8, t / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(cx + t * 0.1, by - h, t * 0.4, h);
}

export function drawPine(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  const h = w * (2.1 + v * 0.9);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(cx - w * 0.06, by - h * 0.2, w * 0.12, h * 0.2);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers;
    const tw = w * (0.55 - f * 0.1);
    const top = by - h * (0.32 + f * 0.2) - h * 0.28;
    ctx.fillStyle = i % 2 ? '#1f4f34' : '#245a3b';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + tw, by - h * (0.15 + f * 0.2));
    ctx.lineTo(cx - tw, by - h * (0.15 + f * 0.2));
    ctx.closePath();
    ctx.fill();
  }
}

const TOWER = ['#1b1f3a', '#232848', '#2b2242', '#18233a'];

export function drawBuilding(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 2) return;
  const h = w * (1.6 + v * 2.4);
  const x0 = cx - w / 2;
  ctx.fillStyle = TOWER[Math.floor(v * TOWER.length) % TOWER.length];
  ctx.fillRect(x0, by - h, w, h);
  if (w < 10) return;
  // Lit windows in a fixed pattern from the variant, so they do not flicker.
  const cols = 4;
  const rows = Math.max(3, Math.floor(h / (w / 3)));
  const cw = w / cols;
  const ch = h / rows;
  let seed = Math.floor(v * 9973);
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 === 0) continue;
      ctx.fillStyle = seed % 7 === 0 ? '#7fd4ff' : '#ffd77a';
      ctx.fillRect(x0 + c * cw + cw * 0.25, by - h + r * ch + ch * 0.3, cw * 0.5, ch * 0.4);
    }
  // A neon strip on some towers.
  if (v > 0.6) {
    ctx.fillStyle = v > 0.8 ? '#ff4fa3' : '#43e8ff';
    ctx.fillRect(x0, by - h * 0.92, w, Math.max(2, w * 0.04));
  }
}

export function drawLamp(ctx: Ctx, cx: number, by: number, w: number, v: number) {
  if (w < 1) return;
  const h = w * 6;
  const side = v > 0.5 ? 1 : -1;
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(cx - w * 0.15, by - h, w * 0.3, h);
  ctx.fillRect(cx - (side < 0 ? w * 1.4 : 0), by - h, w * 1.4, w * 0.25);
  const lx = cx - side * -w * 1.3;
  const g = ctx.createRadialGradient(lx, by - h + w * 0.3, 0, lx, by - h + w * 0.3, w * 2.2);
  g.addColorStop(0, 'rgba(255,220,140,0.9)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(lx - w * 2.2, by - h - w * 2, w * 4.4, w * 4.4);
}
