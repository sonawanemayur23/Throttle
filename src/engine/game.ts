import type { BikeStats } from '../content/bikes';
import type { LevelDef } from '../content/career';
import type { TrackDef } from '../content/tracks';
import type { Sound } from './audio';
import {
  ACCEL,
  BIKE_HALF,
  BRAKE,
  CAR_HALF,
  CENTRIFUGAL,
  DECEL,
  KMH_AT_MAX,
  MAX_SPEED,
  OFFROAD_DECEL,
  OFFROAD_LIMIT,
  RIVAL_COUNT,
  SEG_LEN,
  TRAFFIC_COUNT,
} from './config';
import type { Input } from './input';
import { Track } from './track';
import { clamp, loopDiff, mod } from './util';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Weapon = 'club' | 'chain';

export const WEAPONS: Record<Weapon, { label: string; dmg: number; reach: number; push: number; uses: number; cd: number }> = {
  club: { label: 'CLUB', dmg: 48, reach: 0.4, push: 0.18, uses: 6, cd: 0.55 },
  chain: { label: 'CHAIN', dmg: 38, reach: 0.52, push: 0.3, uses: 8, cd: 0.5 },
};

export interface ScreenPos {
  sx: number;
  sy: number;
  sw: number;
  visible: boolean;
}

export interface Rider extends ScreenPos {
  d: number; // distance travelled since the start line, not wrapped
  x: number; // road offset, -1..1 is tarmac
  speed: number;
  hp: number;
  down: boolean;
  downT: number;
  tumble: number;
  punchT: number;
  kickT: number;
  armSide: number;
  lean: number;
  flash: number;
  weapon: Weapon | null;
  weaponUses: number;
  swingT: number;
}

export interface Rival extends Rider {
  name: string;
  color: string;
  helmet: string;
  skill: number;
  aggression: number;
  cd: number;
  laneBias: number;
  lastHitByPlayer: number;
  finishTime: number;
  hunt: boolean;
  huntT: number;
}

export interface Cop extends Rider {
  active: boolean;
  respawnT: number;
  cd: number;
}

export interface Player extends Rider {
  maxSpeed: number;
  hpMax: number;
  invuln: number;
  cdPunch: number;
  cdKick: number;
  cdWeapon: number;
  lastHurt: number;
  crashed: boolean;
}

export interface Car extends ScreenPos {
  z: number; // wrapped position on the loop
  x: number;
  speed: number;
  color: string;
  kind: number;
  prevDz: number;
}

export interface Popup {
  text: string;
  sub?: string;
  t: number;
  life: number;
  color: string;
  big: boolean;
}

export interface Hint {
  text: string;
  t: number;
  life: number;
}

export type Phase = 'title' | 'countdown' | 'race' | 'finished';

/** Everything a race needs. Built by the app from content and the save. */
export interface RaceSetup {
  track: TrackDef;
  bike: BikeStats;
  level: LevelDef;
  tutorial: boolean;
}

export interface Results {
  trackId: string;
  level: number;
  place: number;
  time: number;
  kos: number;
  copKos: number;
  nearMisses: number;
  topCombo: number;
  prize: number;
  score: number;
  busted: boolean;
  fine: number;
}

// ---------------------------------------------------------------------------

const RIVAL_DEFS: Array<[string, string, string]> = [
  ['Vex', '#e8452c', '#ffd34d'],
  ['Kilo', '#2f7df6', '#f4f4f4'],
  ['Nyx', '#8c3cf0', '#1d1d1d'],
  ['Dune', '#f0a020', '#6b3f12'],
  ['Rook', '#20b36b', '#e8e8e8'],
  ['Jax', '#e83c8c', '#2b2b2b'],
];
const CAR_COLORS = ['#d9d9d9', '#3a6ea5', '#b23a3a', '#2e2e2e', '#e0c341', '#4f8f5b', '#f2f2f2', '#7a4fa0'];

const newRider = (d: number, x: number, hp = 100): Rider => ({
  d,
  x,
  speed: 0,
  hp,
  down: false,
  downT: 0,
  tumble: 0,
  punchT: 0,
  kickT: 0,
  armSide: 1,
  lean: 0,
  flash: 0,
  weapon: null,
  weaponUses: 0,
  swingT: 0,
  sx: 0,
  sy: 0,
  sw: 0,
  visible: false,
});

const newPlayer = (bike: BikeStats): Player => ({
  ...newRider(0, 0, bike.hp),
  maxSpeed: MAX_SPEED * bike.topSpeed,
  hpMax: bike.hp,
  invuln: 0,
  cdPunch: 0,
  cdKick: 0,
  cdWeapon: 0,
  lastHurt: -10,
  crashed: false,
});

const newCop = (): Cop => ({ ...newRider(0, 0, 140), active: false, respawnT: 0, cd: 0, weapon: 'club', weaponUses: 999 });

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not allowed in this frame */
  }
}

const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

export class Game {
  setup: RaceSetup;
  track: Track;
  phase: Phase = 'title';
  player: Player;
  rivals: Rival[] = [];
  cop: Cop = newCop();
  cars: Car[] = [];
  countdown = 0;
  raceTime = 0;
  clock = 0; // real time
  combo = 0;
  comboT = 0;
  topCombo = 0;
  score = 0;
  kos = 0;
  copKos = 0;
  nearMisses = 0;
  popups: Popup[] = [];
  shake = 0;
  flash = 0;
  flashColor = '255,255,255';
  hitstopUntil = 0;
  slowmoUntil = 0;
  results: Results | null = null;
  steer = 0;
  /** First races show short hints that teach the controls. */
  tutorial = false;
  hint: Hint | null = null;
  private hintsShown = new Set<string>();
  private noWeaponNagAt = -10;
  /** Effects the renderer turns into particles at an entity's screen position. */
  events: Array<{ kind: 'spark' | 'ko' | 'dust' | 'cash'; at: ScreenPos; side: number }> = [];

  constructor(
    private sound: Sound,
    private input: Input,
    setup: RaceSetup,
  ) {
    this.setup = setup;
    this.track = new Track(setup.track);
    this.player = newPlayer(setup.bike);
    this.reset();
  }

  get L() {
    return this.track.length;
  }

  /** Show a different track behind the title screen. */
  setAttract(setup: RaceSetup) {
    this.useSetup(setup);
    this.phase = 'title';
    this.reset();
  }

  private useSetup(setup: RaceSetup) {
    if (setup.track.id !== this.track.def.id) this.track = new Track(setup.track);
    this.setup = setup;
    this.tutorial = setup.tutorial;
  }

  reset() {
    const { level, bike, track } = this.setup;
    this.player = newPlayer(bike);
    this.rivals = RIVAL_DEFS.slice(0, RIVAL_COUNT).map(([name, color, helmet], i) => ({
      ...newRider(260 + i * 330, [-0.5, 0.5, 0, -0.45, 0.45, 0][i]),
      name,
      color,
      helmet,
      skill: between(level.rivalSkill),
      aggression: between(level.rivalAggression),
      cd: 2 + Math.random() * 2,
      laneBias: (Math.random() * 2 - 1) * 0.6,
      lastHitByPlayer: -10,
      finishTime: 0,
      hunt: false,
      huntT: Math.random() * 2,
    }));
    // Some riders start armed. Knock them out to take their weapon.
    const armed = [...this.rivals].sort(() => Math.random() - 0.5).slice(0, level.armed);
    armed.forEach((r, i) => {
      r.weapon = i % 2 === 0 ? 'club' : 'chain';
      r.weaponUses = 99;
    });
    this.cop = newCop();
    this.cop.respawnT = 12 + Math.random() * 6;
    this.cars = [];
    const count = Math.round(TRAFFIC_COUNT * track.traffic * level.traffic);
    for (let i = 0; i < count; i++) {
      const lane = [-0.66, 0, 0.66][Math.floor(Math.random() * 3)];
      this.cars.push({
        z: 6000 + Math.random() * (this.L - 9000),
        x: lane,
        speed: MAX_SPEED * (0.22 + Math.random() * 0.25),
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        kind: Math.floor(Math.random() * 3),
        prevDz: 0,
        sx: 0,
        sy: 0,
        sw: 0,
        visible: false,
      });
    }
    this.raceTime = 0;
    this.combo = 0;
    this.comboT = 0;
    this.topCombo = 0;
    this.score = 0;
    this.kos = 0;
    this.copKos = 0;
    this.nearMisses = 0;
    this.popups = [];
    this.results = null;
    this.events = [];
    this.hint = null;
    this.hintsShown.clear();
  }

  start(setup: RaceSetup) {
    this.useSetup(setup);
    this.reset();
    this.phase = 'countdown';
    this.countdown = 3;
    this.sound.beep(false);
    this.input.clearPressed();
  }

  /** Show a teaching hint once per race. */
  showHint(key: string, text: string, life = 3.2) {
    if (!this.tutorial || this.hintsShown.has(key)) return;
    this.hintsShown.add(key);
    this.hint = { text, t: 0, life };
  }

  private touchText(touch: string, keys: string) {
    return this.input.lastTouch ? touch : keys;
  }

  place() {
    return 1 + this.rivals.filter((r) => r.d > this.player.d).length;
  }

  kmh() {
    return Math.round((this.player.speed / MAX_SPEED) * KMH_AT_MAX);
  }

  popup(text: string, color = '#fff', big = false, sub?: string) {
    // Keep at most 3 on screen so text never piles up.
    this.popups = this.popups.filter((p) => p.big !== big || !big).slice(-2);
    this.popups.push({ text, sub, t: 0, life: big ? 1.3 : 0.9, color, big });
  }

  private addCombo(points: number) {
    this.combo = Math.min(this.combo + 1, 10);
    this.comboT = 2.6;
    this.topCombo = Math.max(this.topCombo, this.combo);
    this.score += points * this.combo;
  }

  update(dtReal: number) {
    this.clock += dtReal;
    let ts = 1;
    if (this.clock < this.hitstopUntil) ts = 0.06;
    else if (this.clock < this.slowmoUntil) ts = 0.28;
    const dt = dtReal * ts;

    this.shake = Math.max(0, this.shake - dtReal * 40);
    this.flash = Math.max(0, this.flash - dtReal * 3);
    for (const p of this.popups) p.t += dtReal;
    this.popups = this.popups.filter((p) => p.t < p.life);
    if (this.hint) {
      this.hint.t += dtReal;
      if (this.hint.t > this.hint.life) this.hint = null;
    }

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dtReal;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.sound.beep(false);
      if (this.countdown <= 0) {
        this.phase = 'race';
        this.sound.beep(true);
        this.popup('GO!', '#ffd34d', true);
        this.showHint('steer', this.touchText('Hold the left pad to steer. Throttle is automatic.', 'Hold UP to go. LEFT and RIGHT to steer.'));
      }
      this.updateTraffic(dt);
      this.sound.engine(0.08, true);
      this.sound.siren(0);
      return;
    }
    if (this.phase === 'title') {
      this.player.speed = MAX_SPEED * 0.5;
      this.player.d += this.player.speed * dt;
      this.updateTraffic(dt);
      this.sound.siren(0);
      return;
    }
    if (this.phase === 'finished') {
      // Coast to a stop after the line.
      const p = this.player;
      p.speed = Math.max(0, p.speed + DECEL * 1.5 * dt);
      p.d += p.speed * dt;
      p.x += (0 - p.x) * dt;
      for (const r of this.rivals) if (!r.down) r.d += r.speed * dt;
      if (this.cop.active && !this.cop.down) {
        this.cop.speed = p.speed;
        this.cop.d += this.cop.speed * dt;
      }
      this.updateTraffic(dt);
      this.sound.engine(p.speed / MAX_SPEED, true);
      this.sound.siren(this.results?.busted ? 0.6 : 0);
      return;
    }

    this.raceTime += dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.updatePlayer(dt);
    this.updateRivals(dt);
    this.updateCop(dt);
    this.updateTraffic(dt);
    this.sound.engine(this.player.speed / MAX_SPEED, true);

    if (this.phase === 'race' && this.player.d >= this.L) this.finish(false);
  }

  // -------------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------------

  private updatePlayer(dt: number) {
    const p = this.player;
    const bike = this.setup.bike;
    const inp = this.input;
    const seg = this.track.find(p.d);
    const speedPct = p.speed / MAX_SPEED;

    p.cdPunch -= dt;
    p.cdKick -= dt;
    p.invuln -= dt;
    p.punchT -= dt;
    p.kickT -= dt;
    p.swingT -= dt;
    p.cdWeapon -= dt;
    p.flash -= dt * 4;

    if (p.crashed) {
      p.downT -= dt;
      p.tumble += dt * 9;
      p.speed = Math.max(0, p.speed + BRAKE * 0.9 * dt);
      p.d += p.speed * dt;
      if (p.downT <= 0) {
        p.crashed = false;
        p.down = false;
        p.tumble = 0;
        p.x = clamp(p.x, -0.7, 0.7);
        p.hp = Math.max(p.hp, p.hpMax * 0.5);
        p.invuln = 1.6;
        p.speed = MAX_SPEED * 0.12;
      }
      inp.clearPressed();
      return;
    }

    // Better tyres steer harder and resist the pull of the curve.
    const dx = dt * 2 * Math.max(speedPct, 0.15) * bike.handling;
    const steer = inp.axis();
    this.steer = steer;
    p.x += steer * dx;
    // The curve pulls the bike outward; grip resists it.
    p.x -= (dt * 2 * Math.max(speedPct, 0.15) * speedPct * seg.curve * CENTRIFUGAL) / bike.handling;

    if (inp.throttle()) p.speed += ACCEL * bike.accel * dt;
    else if (inp.isDown('down')) p.speed += BRAKE * dt;
    else p.speed += DECEL * dt;

    const offroad = Math.abs(p.x) > 1.05;
    if (offroad && p.speed > OFFROAD_LIMIT) {
      p.speed += (OFFROAD_DECEL / bike.offroadGrip) * dt;
      this.shake = Math.max(this.shake, 2.5);
    }
    p.x = clamp(p.x, -2.2, 2.2);
    p.speed = clamp(p.speed, 0, p.maxSpeed);
    p.d += p.speed * dt;
    p.lean += (steer * 0.32 + seg.curve * speedPct * 0.03 - p.lean) * Math.min(1, dt * 10);

    if (p.hp < p.hpMax && this.raceTime - p.lastHurt > 3) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.04 * dt);

    // Attacks.
    if (inp.take('punch') && p.cdPunch <= 0) {
      p.cdPunch = 0.3;
      p.punchT = 0.17;
      this.attack(20, 0.3, 0.07, 'punch');
    }
    if (inp.take('kick') && p.cdKick <= 0) {
      p.cdKick = 0.62;
      p.kickT = 0.26;
      this.attack(32, 0.38, 0.26, 'kick');
    }
    if (inp.take('weapon')) {
      if (!p.weapon) {
        if (this.raceTime - this.noWeaponNagAt > 2) {
          this.noWeaponNagAt = this.raceTime;
          this.popup('NO WEAPON YET', '#ffb199', false);
          this.showHint('noweapon', 'Knock out a rider holding a club or chain to take it.', 3);
        }
      } else if (p.cdWeapon <= 0) {
        const w = WEAPONS[p.weapon];
        p.cdWeapon = w.cd;
        p.swingT = 0.28;
        this.attack(w.dmg, w.reach, w.push, 'weapon');
        p.weaponUses--;
        if (p.weaponUses <= 0) {
          this.popup(`${w.label} BROKE`, '#ffb199');
          p.weapon = null;
        }
      }
    }

    // Teach fighting the first time a rider is in reach.
    if (this.tutorial && !this.hintsShown.has('punch')) {
      const near = this.rivals.some((r) => !r.down && Math.abs(r.d - p.d) < 300 && Math.abs(r.x - p.x) < 0.45);
      if (near) this.showHint('punch', this.touchText('Rider next to you. Tap PUNCH or KICK.', 'Rider next to you. Press J to punch, K to kick.'));
    }
  }

  private attack(dmg: number, reach: number, push: number, kind: 'punch' | 'kick' | 'weapon') {
    const p = this.player;
    let best: Rival | Cop | null = null;
    let bestDist = Infinity;
    const targets: Array<Rival | Cop> = [...this.rivals];
    if (this.cop.active) targets.push(this.cop);
    for (const r of targets) {
      if (r.down) continue;
      const dd = r.d - p.d;
      const dx = r.x - p.x;
      if (dd < -170 || dd > 240 || Math.abs(dx) > reach) continue;
      const dist = Math.abs(dd) / 400 + Math.abs(dx);
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    }
    if (!best) {
      p.armSide = -p.armSide;
      this.sound.whiff();
      return;
    }
    const side = Math.sign(best.x - p.x) || p.armSide;
    p.armSide = side;
    best.hp -= dmg;
    best.x += push * side;
    best.flash = 1;
    const heavy = kind !== 'punch';
    best.speed *= heavy ? 0.9 : 0.96;
    this.addCombo(kind === 'weapon' ? 60 : heavy ? 40 : 25);
    this.hitstopUntil = this.clock + (kind === 'weapon' ? 0.1 : heavy ? 0.08 : 0.05);
    this.shake = Math.max(this.shake, kind === 'weapon' ? 13 : heavy ? 10 : 6);
    this.events.push({ kind: 'spark', at: best, side });
    this.sound.hit(heavy);
    vibrate(kind === 'weapon' ? 35 : heavy ? 25 : 12);

    if (best === this.cop) {
      if (best.hp <= 0) this.knockOutCop();
      return;
    }
    const r = best as Rival;
    r.lastHitByPlayer = this.raceTime;
    // A kick can knock the weapon loose.
    if (kind === 'kick' && r.weapon && !p.weapon && Math.random() < 0.3) this.takeWeapon(r);
    if (r.hp <= 0) this.knockOut(r, 'KNOCKOUT');
    else if (Math.abs(r.x) > 1.3 && r.speed > MAX_SPEED * 0.4) this.knockOut(r, 'OFF THE ROAD');
  }

  private takeWeapon(r: Rival) {
    const p = this.player;
    if (!r.weapon) return;
    const w = r.weapon;
    p.weapon = w;
    p.weaponUses = WEAPONS[w].uses;
    r.weapon = null;
    this.popup(`GOT ${WEAPONS[w].label}`, '#7dff9a', false);
    this.showHint('weapon', this.touchText(`Tap the ${WEAPONS[w].label} button to swing it.`, `Press L to swing the ${WEAPONS[w].label.toLowerCase()}.`), 3.5);
    this.sound.coin();
  }

  private knockOut(r: Rival, label: string) {
    if (r.weapon) this.takeWeapon(r);
    r.down = true;
    r.downT = 3.2;
    r.hp = 0;
    this.kos++;
    this.addCombo(300);
    const cash = 50 * (2 + Math.floor(Math.random() * 7));
    this.score += cash;
    this.popup(label, '#ffd34d', true, `${r.name} down  +$${cash}`);
    this.koJuice(r);
  }

  private knockOutCop() {
    const c = this.cop;
    c.down = true;
    c.downT = 3.5;
    c.hp = 0;
    c.respawnT = 25;
    this.copKos++;
    this.addCombo(400);
    this.score += 800;
    this.popup('COP DOWN', '#7fb8ff', true, '+$800. More will come.');
    this.koJuice(c);
  }

  private koJuice(r: Rider) {
    this.slowmoUntil = this.clock + 0.5;
    this.hitstopUntil = this.clock + 0.09;
    this.shake = 18;
    this.flash = 0.5;
    this.flashColor = '255,240,200';
    this.events.push({ kind: 'ko', at: r, side: Math.sign(r.x - this.player.x) || 1 });
    this.events.push({ kind: 'cash', at: r, side: 0 });
    this.sound.knockout();
    setTimeout(() => this.sound.coin(), 250);
    vibrate([30, 40, 60]);
  }

  private hurtPlayer(dmg: number, side: number, by: Rider) {
    const p = this.player;
    if (p.invuln > 0 || p.crashed) return;
    const armed = by.weapon !== null;
    p.hp -= (armed ? dmg * 1.6 : dmg) * this.setup.bike.damageTaken;
    p.x += (armed ? 0.16 : 0.1) * side;
    p.flash = 1;
    p.lastHurt = this.raceTime;
    if (armed) by.swingT = 0.28;
    else by.punchT = 0.2;
    by.armSide = -side;
    this.shake = Math.max(this.shake, 8);
    this.flash = 0.35;
    this.flashColor = '255,40,40';
    this.sound.hurt();
    vibrate(20);
    if (p.hp < p.hpMax * 0.45) this.showHint('health', 'Health low. Back off and it refills.', 2.5);
    if (p.hp <= 0) this.crashPlayer('WIPED OUT');
  }

  private crashPlayer(label: string) {
    const p = this.player;
    p.crashed = true;
    p.down = true;
    p.downT = 1.9;
    p.tumble = 0;
    p.hp = 0;
    this.combo = 0;
    this.comboT = 0;
    this.shake = 22;
    this.flash = 0.6;
    this.flashColor = '255,60,40';
    this.popup(label, '#ff5a3c', true);
    this.events.push({ kind: 'dust', at: { sx: 0, sy: 0, sw: 0, visible: false }, side: 0 });
    this.sound.crash();
    vibrate([60, 30, 120]);
  }

  // -------------------------------------------------------------------------
  // Rivals and police
  // -------------------------------------------------------------------------

  /** Steer around traffic. Returns true if the rider hit a car. */
  private avoidTraffic(r: Rider, aim: { x: number; speed: number }) {
    const rz = mod(r.d, this.L);
    for (const c of this.cars) {
      const dz = loopDiff(c.z, rz, this.L);
      if (dz <= 0 || dz > 1800) continue;
      if (Math.abs(c.x - r.x) < 0.38) {
        aim.x = c.x > r.x ? c.x - 0.48 : c.x + 0.48;
        if (dz < 500 && Math.abs(c.x - r.x) < 0.27) aim.speed = Math.min(aim.speed, c.speed);
      }
      if (dz < 90 && Math.abs(c.x - r.x) < CAR_HALF + BIKE_HALF && r.speed > c.speed + 1500) return true;
    }
    return false;
  }

  private moveRider(r: Rider, aim: { x: number; speed: number }, dt: number) {
    const tx = clamp(aim.x, -0.88, 0.88);
    r.speed += Math.sign(aim.speed - r.speed) * Math.min(Math.abs(aim.speed - r.speed), ACCEL * 1.1 * dt);
    if (Math.abs(r.x) > 1.05) r.speed = Math.max(OFFROAD_LIMIT, r.speed + OFFROAD_DECEL * dt);
    const steer = clamp(tx - r.x, -1, 1);
    r.x += steer * Math.min(1, dt * 1.6);
    r.lean += (steer * 0.6 - r.lean) * Math.min(1, dt * 8);
    r.d += r.speed * dt;
  }

  private downTick(r: Rider, dt: number) {
    r.downT -= dt;
    r.tumble += dt * 8;
    r.speed = Math.max(0, r.speed - MAX_SPEED * 1.1 * dt);
    r.d += r.speed * dt;
  }

  private updateRivals(dt: number) {
    const p = this.player;
    for (const r of this.rivals) {
      r.punchT -= dt;
      r.swingT -= dt;
      r.flash -= dt * 4;
      if (r.down) {
        this.downTick(r, dt);
        if (r.downT <= 0) {
          r.down = false;
          r.hp = 70;
          r.tumble = 0;
          r.x = clamp(r.x, -0.8, 0.8);
          r.speed = MAX_SPEED * 0.25;
          // Some riders come back with a new weapon.
          if (!r.weapon && Math.random() < 0.25) {
            r.weapon = Math.random() < 0.5 ? 'club' : 'chain';
            r.weaponUses = 99;
          }
        }
        continue;
      }
      const gap = r.d - p.d;
      const aim = { x: r.laneBias, speed: MAX_SPEED * r.skill };
      // Keep the pack close so there is always someone to fight.
      if (gap < -4000) aim.speed *= 1.18;
      else if (gap < -1500) aim.speed *= 1.06;
      else if (gap > 9000) aim.speed *= 0.8;
      else if (gap > 3500) aim.speed *= 0.92;
      const engaged = Math.abs(gap) < 1100 && !p.crashed;
      r.huntT -= dt;
      if (r.huntT <= 0) {
        r.huntT = 2 + Math.random() * 3;
        r.hunt = Math.random() < r.aggression;
      }
      if (engaged && r.hunt) {
        aim.speed = clamp(p.speed + (gap < 0 ? 700 : -350), MAX_SPEED * 0.3, MAX_SPEED * 1.25);
        aim.x = p.x + (r.x >= p.x ? 0.17 : -0.17);
      }
      if (this.avoidTraffic(r, aim)) {
        r.down = true;
        r.downT = 2.6;
        if (this.raceTime - r.lastHitByPlayer < 2.5) this.knockOut(r, 'TRAFFIC KO');
        continue;
      }
      this.moveRider(r, aim, dt);

      // Rivals fight back.
      const dx = p.x - r.x;
      r.cd -= dt;
      if (!p.crashed && Math.abs(gap) < 170 && Math.abs(dx) < 0.3 && r.cd <= 0) {
        r.cd = 1.1 + Math.random() * 1.6;
        if (Math.random() < r.aggression) this.hurtPlayer(8 + Math.random() * 7, Math.sign(dx) || 1, r);
      }
      this.bump(r, gap, dx);
      if (r.d >= this.L && !r.finishTime) r.finishTime = this.raceTime;
    }
  }

  private bump(r: Rider, gap: number, dx: number) {
    if (Math.abs(gap) < 110 && Math.abs(dx) < 0.13) {
      const push = (0.13 - Math.abs(dx)) * 0.5 * (Math.sign(dx) || 1);
      this.player.x += push;
      r.x -= push;
    }
  }

  private updateCop(dt: number) {
    const c = this.cop;
    const p = this.player;
    if (!this.setup.level.cops) {
      this.sound.siren(0);
      return;
    }
    c.punchT -= dt;
    c.swingT -= dt;
    c.flash -= dt * 4;
    if (!c.active) {
      c.respawnT -= dt;
      this.sound.siren(0);
      // Leave the last stretch free so a chase never starts at the line.
      if (c.respawnT <= 0 && p.d < this.L - 30000) {
        Object.assign(c, newCop(), { active: true, d: p.d - 2600, x: 0, speed: p.speed });
        this.popup('POLICE', '#7fb8ff');
        this.showHint('cops', 'Police behind you. Do not crash or slow down near them. Punch or kick them off.', 4);
      }
      return;
    }
    if (c.down) {
      this.downTick(c, dt);
      if (c.downT <= 0) c.active = false;
      this.sound.siren(0);
      return;
    }
    const gap = c.d - p.d;
    // Lose them by getting far enough ahead.
    if (gap < -7000) {
      c.active = false;
      c.respawnT = 20;
      this.popup('LOST THE POLICE', '#7fb8ff');
      this.sound.siren(0);
      return;
    }
    const aim = {
      x: p.x + (c.x >= p.x ? 0.2 : -0.2),
      speed: gap < -400 ? Math.min(p.speed + 2200, MAX_SPEED * 1.2) : clamp(p.speed + (gap < 0 ? 400 : -300), MAX_SPEED * 0.2, MAX_SPEED * 1.2),
    };
    if (this.avoidTraffic(c, aim)) aim.speed *= 0.5;
    this.moveRider(c, aim, dt);
    const dx = p.x - c.x;

    // Busted: caught while down or crawling.
    if (Math.abs(gap) < 220 && Math.abs(dx) < 0.4 && (p.crashed || p.speed < MAX_SPEED * 0.22)) {
      this.finish(true);
      return;
    }
    c.cd -= dt;
    if (!p.crashed && Math.abs(gap) < 170 && Math.abs(dx) < 0.32 && c.cd <= 0) {
      c.cd = 1.4 + Math.random();
      this.hurtPlayer(7 + Math.random() * 5, Math.sign(dx) || 1, c);
    }
    this.bump(c, gap, dx);
    this.sound.siren(clamp(1 - Math.abs(gap) / 5000, 0, 1));
  }

  // -------------------------------------------------------------------------
  // Traffic
  // -------------------------------------------------------------------------

  private updateTraffic(dt: number) {
    const p = this.player;
    const pz = mod(p.d, this.L);
    for (const c of this.cars) {
      c.z = mod(c.z + c.speed * dt, this.L);
      if (this.phase !== 'race' || p.crashed) {
        c.prevDz = loopDiff(c.z, pz, this.L);
        continue;
      }
      const dz = loopDiff(c.z, pz, this.L);
      const dx = Math.abs(c.x - p.x);
      if (dz > -40 && dz < 100 && dx < CAR_HALF + BIKE_HALF && p.speed > c.speed) {
        if (p.invuln > 0) {
          p.speed = c.speed * 0.9;
        } else if (p.speed > MAX_SPEED * 0.5) {
          this.crashPlayer('CRASHED');
        } else {
          p.speed = c.speed * 0.6;
          p.x += c.x > p.x ? -0.12 : 0.12;
          this.shake = Math.max(this.shake, 9);
          this.sound.hurt();
        }
      } else if (c.prevDz > 0 && dz <= 0 && dz > -SEG_LEN * 3 && dx < 0.48 && p.speed > MAX_SPEED * 0.6) {
        this.nearMisses++;
        this.addCombo(20);
        this.popup(`NEAR MISS x${this.combo}`, '#7fe3ff');
        this.sound.nearMiss();
      }
      c.prevDz = dz;
    }
  }

  // -------------------------------------------------------------------------

  private finish(busted: boolean) {
    this.phase = 'finished';
    const level = this.setup.level;
    const place = this.place();
    const prize = busted ? 0 : (level.prize[place - 1] ?? 0);
    this.score += prize;
    this.results = {
      trackId: this.track.def.id,
      level: level.level,
      place,
      time: this.raceTime,
      kos: this.kos,
      copKos: this.copKos,
      nearMisses: this.nearMisses,
      topCombo: this.topCombo,
      prize,
      score: this.score,
      busted,
      fine: busted ? level.fine : 0,
    };
    if (busted) {
      this.player.speed = Math.min(this.player.speed, MAX_SPEED * 0.2);
      this.popup('BUSTED', '#7fb8ff', true, `Fine $${level.fine.toLocaleString()}`);
      this.sound.crash();
    } else {
      this.popup(place === 1 ? 'YOU WIN' : 'FINISH', place === 1 ? '#ffd34d' : '#fff', true);
      this.sound.beep(true);
    }
  }
}
