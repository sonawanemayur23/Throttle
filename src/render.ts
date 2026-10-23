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
import { WEAPONS, type Car, type Game, type Rider, type Rival, type ScreenPos } from './game';
import { drawArch, drawBush, drawCar, drawPalm, drawPost, drawRider, drawRock, drawSign, type RiderLook } from './sprites';
import type { Pt, Segment, Sprite } from './track';
import { hex, lerp, mix, mod, mulberry32, ordinal, type RGB } from './util';

const C = {
  fog: hex('#f2b48a'),
  road: [hex('#5c5a5e'), hex('#545256')] as RGB[],
  grass: [hex('#c9b27c'), hex('#bea672')] as RGB[],
  rumble: [hex('#f4f4f4'), hex('#d23b2f')] as RGB[],
  lane: hex('#eeeeee'),
  start: hex('#ffffff'),
};

const SPRITE_W: Record<Sprite['kind'], number> = {
  palm: 700,
  bush: 650,
  rock: 800,
  sign: 1100,
  post: 60,
  arch: ROAD_W * 2.3,
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
  | { kind: 'rival'; r: Rival };

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
  private lines: Array<{ a: number; r: number; len: number; speed: number }> = [];

  constructor(private canvas: HTMLCanvasElement) {
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
    for (let i = 0; i < 40; i++) this.lines.push({ a: Math.random() * Math.PI * 2, r: Math.random(), len: 0.1 + Math.random() * 0.2, speed: 1 + Math.random() });
    this.resize();
  }

  resize() {
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

  render(g: Game, dt: number) {
    const ctx = this.ctx;
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

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * (w / 800), (Math.random() - 0.5) * g.shake * (w / 800));

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
      this.drawSegment(seg, fog);
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
      drawRider(ctx, w / 2, py + bounce, pw, { ...this.look(p, '#16181d', '#f2f2f2'), jacket: '#2b2f3a', player: true });
    };

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
        if (d.kind === 'car') this.drawEntity(seg, d.c, d.c.z, d.c.x, CAR_WORLD_W, fogA, (ex, ey, ew) => drawCar(ctx, ex, ey, ew, d.c.color, d.c.kind));
        else if (d.kind === 'rival') {
          const r = d.r;
          this.drawEntity(seg, r, mod(r.d, L), r.x, BIKE_WORLD_W, fogA, (ex, ey, ew) => drawRider(ctx, ex, ey, ew, this.look(r, r.color, r.helmet)));
          if (r.visible && !r.down && r.sw > 18 && r.hp < 100) this.hpPip(r);
        }
      }
    }

    if (!playerDrawn) drawPlayer();

    this.speedLines(g.kmh(), dt);
    this.handleEvents(g);
    this.drawParticles(dt);
    ctx.restore();

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
    }
  }

  private drawSky(playerY: number) {
    const ctx = this.ctx;
    const { w, h } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, '#2b2257');
    sky.addColorStop(0.45, '#b4506e');
    sky.addColorStop(0.8, '#f08a5d');
    sky.addColorStop(1, '#f6c08f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun.
    const sx = w * (0.5 + ((this.skyOffset * 3) % 1) - 0.5);
    const sy = h * 0.4;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.18);
    sun.addColorStop(0, 'rgba(255,240,190,1)');
    sun.addColorStop(0.5, 'rgba(255,200,120,0.9)');
    sun.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(sx - h * 0.2, sy - h * 0.2, h * 0.4, h * 0.4);

    // Ridges with parallax. Hills shift them up and down a little.
    const colors = ['#7d4a6e', '#a35a68', '#c8735f'];
    const lift = playerY / 30000;
    this.ridges.forEach((pts, layer) => {
      const speed = [0.6, 1, 1.6][layer];
      const off = (this.skyOffset * speed) % 1;
      const baseY = h * (0.5 + layer * 0.025) + lift * h * (layer + 1) * 0.03;
      const amp = h * (0.16 - layer * 0.035);
      ctx.fillStyle = colors[layer];
      ctx.beginPath();
      ctx.moveTo(0, h);
      const n = pts.length;
      for (let i = 0; i <= 32; i++) {
        const u = i / 32 + off;
        const f = (u * n) % n;
        const i0 = Math.floor(f);
        const v = lerp(pts[(i0 + n) % n], pts[(i0 + 1 + n) % n], f - i0);
        ctx.lineTo((i / 32) * w, baseY - v * amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });
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

  private drawSegment(seg: Segment, fog: number) {
    const { w } = this;
    const a = seg.p1.screen;
    const b = seg.p2.screen;
    const k = seg.dark ? 1 : 0;
    const f = 1 - fog;
    const ctx = this.ctx;
    ctx.fillStyle = mix(C.grass[k], C.fog, f);
    ctx.fillRect(0, b.y, w, a.y - b.y);

    const r1 = a.w / 9;
    const r2 = b.w / 9;
    // Bottom edges overlap by 1px to hide anti-aliasing seams between segments.
    const ay = a.y + 1;
    this.poly(a.x - a.w - r1, ay, a.x - a.w, ay, b.x - b.w, b.y, b.x - b.w - r2, b.y, mix(C.rumble[k], C.fog, f));
    this.poly(a.x + a.w + r1, ay, a.x + a.w, ay, b.x + b.w, b.y, b.x + b.w + r2, b.y, mix(C.rumble[k], C.fog, f));
    this.poly(a.x - a.w, ay, a.x + a.w, ay, b.x + b.w, b.y, b.x - b.w, b.y, seg.start ? mix(C.start, C.fog, f) : mix(C.road[k], C.fog, f));

    if (!seg.dark && !seg.start) {
      const l1 = a.w / 50;
      const l2 = b.w / 50;
      const laneW1 = (a.w * 2) / LANES;
      const laneW2 = (b.w * 2) / LANES;
      let lx1 = a.x - a.w + laneW1;
      let lx2 = b.x - b.w + laneW2;
      for (let lane = 1; lane < LANES; lane++, lx1 += laneW1, lx2 += laneW2) {
        this.poly(lx1 - l1 / 2, a.y, lx1 + l1 / 2, a.y, lx2 + l2 / 2, b.y, lx2 - l2 / 2, b.y, mix(C.lane, C.fog, f));
      }
    }
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
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life < p.max);
  }

  private text(t: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'left', weight = 800) {
    const ctx = this.ctx;
    ctx.font = `${weight} ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
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
    const hp = Math.max(0, g.player.hp) / 100;
    ctx.fillStyle = hp > 0.4 ? '#4fe07a' : '#ff5a3c';
    ctx.fillRect(pad, hy, hw * hp, u * 1.6);

    this.weaponSlot(g, pad, hy + u * 2.6, u);
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
