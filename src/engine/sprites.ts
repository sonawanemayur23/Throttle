// Procedural sprites. Every function draws with its origin at bottom center,
// in a box `w` pixels wide. No image files: the whole game stays tiny.

import { svgArt } from './svgart';

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
  /** Lights glow brighter at night. */
  night?: boolean;
  /** 0..1 of top speed, for exhaust flame. */
  speed?: number;
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Lighten (k > 0) or darken (k < 0) a #rrggbb color. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function vgrad(ctx: Ctx, y0: number, y1: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

function hgrad(ctx: Ctx, x0: number, x1: number, edge: string, mid: string) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, edge);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, edge);
  return g;
}

/** Soft contact shadow in screen pixels. */
function shadow(ctx: Ctx, rx: number, ry: number) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRider(ctx: Ctx, cx: number, by: number, w: number, o: RiderLook) {
  if (w < 1.5) return;
  ctx.save();
  ctx.translate(cx, by);
  shadow(ctx, w * 0.5, w * 0.1);

  // Far away riders get a cheap silhouette; detail only where it can be seen.
  const detail = w > 26;
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

  // Rear tyre, rounded by a side-to-side gradient.
  ctx.fillStyle = detail ? hgrad(ctx, -0.13, 0.13, '#08080a', '#34353c') : '#17171b';
  rr(ctx, -0.13, -0.46, 0.26, 0.46, 0.1);
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 5; i++) ctx.fillRect(-0.1, -0.4 + i * 0.075, 0.2, 0.02);
    // Hugger over the tyre.
    ctx.fillStyle = '#1b1c21';
    rr(ctx, -0.15, -0.5, 0.3, 0.07, 0.03);
  }

  // Exhaust can, right side, with a hot tip at speed.
  ctx.fillStyle = detail ? vgrad(ctx, -0.44, -0.32, '#eef1f6', '#6c727d') : '#9aa1ad';
  rr(ctx, 0.13, -0.44, 0.15, 0.1, 0.04);
  if (detail) {
    ctx.fillStyle = '#1b1c21';
    ctx.beginPath();
    ctx.ellipse(0.205, -0.39, 0.045, 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    if ((o.speed ?? 0) > 0.85 && Math.random() < 0.6) {
      ctx.fillStyle = Math.random() < 0.5 ? '#ffb347' : '#7fc8ff';
      ctx.beginPath();
      ctx.ellipse(0.205, -0.39, 0.03, 0.02, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tail section: lit from above, rim highlight on the top edge.
  ctx.fillStyle = detail ? vgrad(ctx, -0.74, -0.42, shade(o.bike, 0.35), shade(o.bike, -0.35)) : o.bike;
  ctx.beginPath();
  ctx.moveTo(-0.31, -0.44);
  ctx.lineTo(0.31, -0.44);
  ctx.lineTo(0.23, -0.73);
  ctx.lineTo(-0.23, -0.73);
  ctx.closePath();
  ctx.fill();
  if (detail) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(-0.22, -0.72);
    ctx.lineTo(0.22, -0.72);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-0.31, -0.49, 0.62, 0.05);
    // Plate and indicators.
    ctx.fillStyle = '#e9e6d8';
    rr(ctx, -0.085, -0.535, 0.17, 0.065, 0.01);
    ctx.fillStyle = '#ffab2e';
    rr(ctx, -0.29, -0.6, 0.06, 0.035, 0.01);
    rr(ctx, 0.23, -0.6, 0.06, 0.035, 0.01);
  }
  // Tail light, glowing.
  ctx.shadowColor = '#ff2a2a';
  ctx.shadowBlur = detail ? w * (o.night ? 0.35 : 0.12) : 0;
  ctx.fillStyle = '#ff3030';
  rr(ctx, -0.12, -0.63, 0.24, 0.06, 0.02);
  ctx.fillStyle = '#ffb3a8';
  rr(ctx, -0.07, -0.615, 0.14, 0.02, 0.01);
  ctx.shadowBlur = 0;

  if (o.cop) {
    // Light bar: alternating red and blue, with a glow.
    const on = Math.floor((o.time ?? 0) * 8) % 2 === 0;
    ctx.fillStyle = '#e8ecf2';
    rr(ctx, -0.26, -0.8, 0.52, 0.07, 0.02);
    ctx.shadowBlur = w * 0.25;
    ctx.shadowColor = on ? '#ff2a2a' : '#2a7bff';
    ctx.fillStyle = on ? '#ff3b3b' : '#4a7dff';
    rr(ctx, -0.26, -0.86, 0.24, 0.08, 0.03);
    ctx.fillStyle = on ? '#4a7dff' : '#ff3b3b';
    rr(ctx, 0.02, -0.86, 0.24, 0.08, 0.03);
    ctx.shadowBlur = 0;
  }

  // Legs: thigh to knee, shin to the peg, kick extends one leg.
  const kick = Math.sin(Math.min(1, o.kick) * Math.PI);
  const pants = '#202229';
  ctx.strokeStyle = pants;
  ctx.lineWidth = 0.13;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 0.13, -0.76);
    if (kick > 0 && sd === o.side) {
      ctx.lineTo(sd * (0.3 + kick * 0.45), -0.68 + kick * 0.05);
      ctx.lineTo(sd * (0.38 + kick * 0.62), -0.63 + kick * 0.08);
    } else {
      ctx.lineTo(sd * 0.31, -0.6);
      ctx.lineTo(sd * 0.28, -0.43);
    }
    ctx.stroke();
  }
  // Boots.
  for (const sd of [-1, 1]) {
    ctx.fillStyle = '#0d0d10';
    if (kick > 0 && sd === o.side) {
      ctx.beginPath();
      ctx.arc(sd * (0.4 + kick * 0.62), -0.6 + kick * 0.08, 0.075, 0, Math.PI * 2);
      ctx.fill();
    } else {
      rr(ctx, sd * 0.28 - 0.065, -0.47, 0.13, 0.1, 0.03);
      if (detail) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(sd * 0.28 - 0.05, -0.45, 0.1, 0.015);
      }
    }
  }

  // Torso, leaning forward: shoulders wider than the waist.
  ctx.fillStyle = detail ? vgrad(ctx, -1.22, -0.7, shade(o.jacket, 0.28), shade(o.jacket, -0.3)) : o.jacket;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.72);
  ctx.lineTo(0.2, -0.72);
  ctx.quadraticCurveTo(0.27, -0.98, 0.25, -1.16);
  ctx.quadraticCurveTo(0, -1.26, -0.25, -1.16);
  ctx.quadraticCurveTo(-0.27, -0.98, -0.2, -0.72);
  ctx.closePath();
  ctx.fill();
  if (detail) {
    // Back protector hump and a racing stripe down the spine.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, -1.0, 0.13, 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.player ? '#ffd34d' : 'rgba(255,255,255,0.55)';
    rr(ctx, -0.03, -1.17, 0.06, 0.43, 0.03);
    // Shoulder pads.
    ctx.fillStyle = shade(o.jacket, 0.4);
    ctx.beginPath();
    ctx.arc(-0.21, -1.12, 0.06, 0, Math.PI * 2);
    ctx.arc(0.21, -1.12, 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arms to the bars, or out in a punch.
  const punch = Math.sin(Math.min(1, o.punch) * Math.PI);
  ctx.strokeStyle = shade(o.jacket, -0.1);
  ctx.lineWidth = 0.1;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sd * 0.21, -1.11);
    if (punch > 0 && sd === o.side) {
      ctx.lineTo(sd * (0.42 + punch * 0.24), -1.09);
      ctx.lineTo(sd * (0.56 + punch * 0.4), -1.05);
    } else {
      ctx.lineTo(sd * 0.33, -0.96);
      ctx.lineTo(sd * 0.35, -0.8);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#111114';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    if (punch > 0 && sd === o.side) ctx.arc(sd * (0.58 + punch * 0.42), -1.05, 0.08, 0, Math.PI * 2);
    else ctx.arc(sd * 0.35, -0.79, 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.weapon) drawHeldWeapon(ctx, o.weapon, o.side, o.swing ?? 0);

  // Helmet: lit from top left, with a stripe and a small spoiler.
  if (detail) {
    const hg = ctx.createRadialGradient(-0.06, -1.42, 0.02, 0, -1.33, 0.18);
    hg.addColorStop(0, shade(o.helmet, 0.6));
    hg.addColorStop(0.55, o.helmet);
    hg.addColorStop(1, shade(o.helmet, -0.45));
    ctx.fillStyle = hg;
  } else ctx.fillStyle = o.helmet;
  ctx.beginPath();
  ctx.arc(0, -1.33, 0.165, 0, Math.PI * 2);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -0.1, -1.2, 0.2, 0.035, 0.015);
    ctx.fillStyle = o.player ? '#ffd34d' : o.cop ? '#1f3a7a' : 'rgba(255,255,255,0.75)';
    rr(ctx, -0.028, -1.49, 0.056, 0.3, 0.025);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-0.07, -1.42, 0.045, 0.025, -0.6, 0, Math.PI * 2);
    ctx.fill();
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
  // SVG art when it has loaded; the code-drawn car below is the fallback.
  ctx.save();
  ctx.translate(cx, by);
  shadow(ctx, w * 0.62, w * 0.08);
  ctx.restore();
  if (svgArt.draw(ctx, 'car-sedan', cx, by, w, { body: color })) {
    if (night) {
      // Tail light glow, matched to the art's light clusters.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const k = w / 400;
      for (const dx of [-148, 148]) {
        const g = ctx.createRadialGradient(cx + dx * k, by - 150 * k, 0, cx + dx * k, by - 150 * k, 60 * k);
        g.addColorStop(0, 'rgba(255,60,40,0.55)');
        g.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx + (dx - 60) * k, by - 210 * k, 120 * k, 120 * k);
      }
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.translate(cx, by);
  shadow(ctx, w * 0.62, w * 0.08);
  ctx.scale(w, w);
  const detail = w > 30;
  // Heights: sedan, SUV, van.
  const H = kind === 2 ? 0.86 : kind === 1 ? 0.7 : 0.54;
  const bodyTop = kind === 2 ? -H : -H * 0.6;
  // Wheels peek out under the body.
  ctx.fillStyle = '#0c0c0e';
  rr(ctx, -0.47, -0.15, 0.17, 0.15, 0.04);
  rr(ctx, 0.3, -0.15, 0.17, 0.15, 0.04);
  // Lower body.
  ctx.fillStyle = detail ? vgrad(ctx, bodyTop, -0.08, shade(color, 0.3), shade(color, -0.35)) : color;
  rr(ctx, -0.5, bodyTop, 1, -0.08 - bodyTop, 0.07);
  if (kind !== 2) {
    // Cabin: narrower glasshouse.
    ctx.fillStyle = detail ? vgrad(ctx, -H, -H * 0.6, shade(color, 0.2), color) : color;
    ctx.beginPath();
    ctx.moveTo(-0.43, -H * 0.58);
    ctx.lineTo(-0.34, -H);
    ctx.lineTo(0.34, -H);
    ctx.lineTo(0.43, -H * 0.58);
    ctx.closePath();
    ctx.fill();
  }
  // Rear window with a sky reflection.
  const wy0 = kind === 2 ? -H * 0.94 : -H * 0.95;
  const wy1 = kind === 2 ? -H * 0.62 : -H * 0.63;
  const wx = kind === 2 ? 0.4 : 0.31;
  if (detail) {
    const wg = ctx.createLinearGradient(0, wy0, 0, wy1);
    wg.addColorStop(0, night ? '#2a2f4a' : '#9fb7cf');
    wg.addColorStop(1, night ? '#0b0d18' : '#2a3446');
    ctx.fillStyle = wg;
  } else ctx.fillStyle = '#1d2533';
  ctx.beginPath();
  ctx.moveTo(-wx - 0.04, wy1);
  ctx.lineTo(-wx + 0.02, wy0);
  ctx.lineTo(wx - 0.02, wy0);
  ctx.lineTo(wx + 0.04, wy1);
  ctx.closePath();
  ctx.fill();
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(-wx + 0.12, wy0);
    ctx.lineTo(-wx + 0.2, wy0);
    ctx.lineTo(-wx + 0.06, wy1);
    ctx.lineTo(-wx - 0.02, wy1);
    ctx.closePath();
    ctx.fill();
    if (kind === 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-0.006, wy1, 0.012, -0.12 - wy1);
    }
    // Roof highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(kind === 2 ? -0.46 : -0.32, -H, kind === 2 ? 0.92 : 0.64, 0.012);
  }
  // Tail lights: a cluster each side, glowing at night.
  const ty = kind === 2 ? -H * 0.48 : -H * 0.5;
  ctx.shadowColor = '#ff2020';
  ctx.shadowBlur = night ? w * 0.18 : detail ? w * 0.04 : 0;
  ctx.fillStyle = '#d61f1f';
  rr(ctx, -0.48, ty, 0.17, 0.08, 0.02);
  rr(ctx, 0.31, ty, 0.17, 0.08, 0.02);
  ctx.shadowBlur = 0;
  if (detail) {
    ctx.fillStyle = '#ff8a7a';
    rr(ctx, -0.46, ty + 0.015, 0.06, 0.03, 0.01);
    rr(ctx, 0.4, ty + 0.015, 0.06, 0.03, 0.01);
    ctx.fillStyle = '#ffab2e';
    rr(ctx, -0.36, ty + 0.015, 0.04, 0.05, 0.01);
    rr(ctx, 0.32, ty + 0.015, 0.04, 0.05, 0.01);
    // Plate, bumper and exhaust.
    ctx.fillStyle = '#ece9dc';
    rr(ctx, -0.1, -H * 0.36, 0.2, 0.07, 0.01);
    ctx.fillStyle = '#1b1c21';
    rr(ctx, -0.5, -0.17, 1, 0.08, 0.03);
    ctx.fillStyle = '#5c616b';
    rr(ctx, 0.22, -0.11, 0.07, 0.03, 0.015);
  }
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
