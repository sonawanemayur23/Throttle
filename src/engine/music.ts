// Original music for this game, synthesized with Web Audio. No recordings
// and no melodies from other games, so there is nothing to license.
//
// Each loop is 4 bars of 16th notes. Notes are scheduled on the audio clock
// and every envelope starts and ends at silence, so the loop has no click.

export type MusicId = 'menu' | 'coast' | 'desert' | 'mountain' | 'city';

export type Voice = 'kick' | 'snare' | 'hat' | 'bass' | 'pad' | 'lead' | 'arp';

export interface Hit {
  step: number;
  dur: number;
  midi: number;
  vel: number;
}

interface Part {
  voice: Voice;
  hits: Hit[];
  steps: number;
}

export interface Score {
  id: MusicId;
  bpm: number;
  steps: number;
  byStep: HitEvent[][];
}

export interface HitEvent {
  voice: Voice;
  midi: number;
  dur: number;
  vel: number;
}

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Note name to MIDI. A4 is 69. */
export function midiOf(name: string) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (Number(m[3]) + 1) * 12 + semi;
}

export function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Length of one 16th note, in seconds. */
export function stepDuration(bpm: number) {
  return 60 / bpm / 4;
}

/**
 * How far the music sits under the engine.
 * 1 is full level (menus). Full speed ducks to 0.3 so the bike stays in front.
 */
export function musicDuck(engineOn: boolean, speedPct: number) {
  if (!engineOn) return 1;
  const speed = Math.min(1, Math.max(0, speedPct));
  return 0.3 + (1 - speed) * 0.4;
}

/** Pitched line. Tokens: `.` rest, `.:4` long rest, `A3:8` held note, `C4+E4:16` chord. */
export function parsePitched(line: string, vel: number): { hits: Hit[]; steps: number } {
  const hits: Hit[] = [];
  let step = 0;
  for (const raw of line.trim().split(/\s+/)) {
    if (!raw) continue;
    const colon = raw.lastIndexOf(':');
    const body = colon === -1 ? raw : raw.slice(0, colon);
    const dur = colon === -1 ? 1 : Number(raw.slice(colon + 1));
    if (!Number.isFinite(dur) || dur <= 0) throw new Error(`Bad duration ${raw}`);
    if (body !== '.') {
      for (const name of body.split('+')) hits.push({ step, dur, midi: midiOf(name), vel });
    }
    step += dur;
  }
  return { hits, steps: step };
}

/** Drum line. `X` is an accent, `x` is a quiet hit, `.` is a rest. Spaces are ignored. */
export function parseDrums(pattern: string, vel: number): { hits: Hit[]; steps: number } {
  const s = pattern.replace(/\s+/g, '');
  const hits: Hit[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '.') continue;
    if (ch !== 'x' && ch !== 'X') throw new Error(`Bad drum step ${ch}`);
    hits.push({ step: i, dur: 1, midi: 0, vel: ch === 'X' ? vel : vel * 0.7 });
  }
  return { hits, steps: s.length };
}

function build(id: MusicId, bpm: number, voices: Array<{ voice: Voice; line?: string; drums?: string; vel: number }>): Score {
  const parts: Part[] = voices.map((v) => {
    const parsed = v.drums ? parseDrums(v.drums, v.vel) : parsePitched(v.line ?? '', v.vel);
    return { voice: v.voice, ...parsed };
  });
  const steps = parts[0]?.steps ?? 0;
  if (steps === 0 || steps % 16 !== 0) throw new Error(`${id} is not a whole number of bars`);
  for (const p of parts) {
    if (p.steps !== steps) throw new Error(`${id} ${p.voice} is ${p.steps} steps, expected ${steps}`);
  }
  const byStep: HitEvent[][] = Array.from({ length: steps }, () => []);
  for (const p of parts) {
    for (const h of p.hits) byStep[h.step].push({ voice: p.voice, midi: h.midi, dur: h.dur, vel: h.vel });
  }
  return { id, bpm, steps, byStep };
}

// Four bars each. Menus are slower and softer. Races push a little harder
// and then get ducked once the engine is up.

const MENU = build('menu', 96, [
  { voice: 'kick', vel: 0.9, drums: 'X.......x....... X.......x....... X.......x....... X.......x...x...' },
  { voice: 'snare', vel: 0.55, drums: '....x.......x... ....x.......x... ....x.......x... ....x.......x...' },
  { voice: 'hat', vel: 0.45, drums: 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.' },
  { voice: 'bass', vel: 0.9, line: 'A2:6 .:2 E2:4 .:4 G2:4 .:2 D2:4 .:2 E2:4 F2:6 .:2 C3:4 .:4 E2:8 A2:8' },
  { voice: 'pad', vel: 0.55, line: 'A3+C4+E4:16 G3+B3+D4:16 F3+A3+C4:16 E3+G#3+B3:16' },
  { voice: 'lead', vel: 0.75, line: '.:2 E4:2 .:2 C5:4 A4:4 G4:2 E4:4 .:2 D4:2 E4:4 A4:4 .:2 C5:2 D5:2 E5:4 C5:4 .:2 A4:2 G4:2 E4:4 D4:2 E4:2 A4:4' },
  { voice: 'arp', vel: 0.4, line: 'A4:2 C5:2 E5:2 C5:2 A4:2 C5:2 E5:2 C5:2 G4:2 B4:2 D5:2 B4:2 G4:2 B4:2 D5:2 B4:2 A4:2 C5:2 F5:2 C5:2 A4:2 C5:2 A4:2 G4:2 E4:2 G#4:2 B4:2 E5:2 D5:2 B4:2 G#4:2 E4:2' },
]);

const COAST = build('coast', 118, [
  { voice: 'kick', vel: 0.95, drums: 'X...x...X...x... X...x...X...x... X...x...X...x... X...x...X..x..x.' },
  { voice: 'snare', vel: 0.6, drums: '....x.......x... ....x.......x... ....x.......x... ....x.......x...' },
  { voice: 'hat', vel: 0.4, drums: 'x.x.x.X.x.x.x.X. x.x.x.X.x.x.x.X. x.x.x.X.x.x.x.X. x.x.x.X.x.x.x.X.' },
  { voice: 'bass', vel: 0.95, line: 'D2:4 A2:2 D2:2 A2:4 D3:4 B1:4 F#2:4 B2:4 F#2:4 G2:4 D2:2 G2:2 D2:4 A2:4 A2:4 E2:4 A2:4 D2:4' },
  { voice: 'pad', vel: 0.4, line: 'D3+F#3+A3:16 B2+D3+F#3:16 G2+B2+D3:16 A2+D3+E3:16' },
  { voice: 'lead', vel: 0.8, line: 'F#4:2 A4:2 D5:4 B4:2 A4:2 F#4:4 A4:2 B4:2 D5:4 A4:2 F#4:2 E4:4 D5:4 B4:2 A4:2 F#4:4 E4:4 D4:2 F#4:2 A4:4 F#4:2 E4:2 D4:4' },
]);

const DESERT = build('desert', 104, [
  { voice: 'kick', vel: 0.85, drums: 'X...........x... X............... X...........x... X.......x.......' },
  { voice: 'snare', vel: 0.5, drums: '........x....... ........x....... ........x....... ........x....x..' },
  { voice: 'hat', vel: 0.35, drums: 'x...x...x...x... x...x...x...x... x...x...x...x... x...x...x...x...' },
  { voice: 'bass', vel: 0.9, line: 'E2:16 B1:16 A2:12 E2:4 B1:8 E2:8' },
  { voice: 'pad', vel: 0.5, line: 'E3+B3:16 B2+F#3:16 A2+E3:16 B2+E3:16' },
  { voice: 'lead', vel: 0.7, line: '.:4 B4:6 .:2 A4:4 .:6 G4:2 A4:4 .:4 .:2 E5:6 .:4 D5:4 B4:4 A4:4 .:2 G4:2 E4:4' },
]);

const MOUNTAIN = build('mountain', 126, [
  { voice: 'kick', vel: 0.95, drums: 'X...x...X...x... X...x...X...x... X...x...X...x... X...x...X...x..x' },
  { voice: 'snare', vel: 0.6, drums: '....x.......x... ....x.......x... ....x.......x... ....x.......x...' },
  { voice: 'hat', vel: 0.42, drums: 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.' },
  { voice: 'bass', vel: 0.95, line: 'B1:2 B1:2 F#2:2 B1:2 B1:2 B1:2 E2:2 F#2:2 A2:2 A2:2 E2:2 A2:2 G2:2 G2:2 D2:2 A2:2 B1:2 B1:2 F#2:2 B1:2 B1:2 D3:2 B2:2 F#2:2 E2:2 E2:2 B1:2 E2:2 F#2:6 B1:2' },
  { voice: 'lead', vel: 0.8, line: 'B4:2 D5:2 F#5:4 E5:2 D5:2 B4:4 D5:2 E5:2 F#5:2 A5:2 F#5:4 D5:4 B4:4 A4:2 B4:2 D5:4 B4:4 F#4:2 A4:2 B4:4 A4:2 F#4:2 B4:4' },
]);

const CITY = build('city', 128, [
  { voice: 'kick', vel: 1, drums: 'X...X...X...X... X...X...X...X... X...X...X...X... X...X...X...X...' },
  { voice: 'snare', vel: 0.62, drums: '....x.......x... ....x.......x... ....x.......x... ....x.....x.x...' },
  { voice: 'hat', vel: 0.4, drums: 'x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x. x.x.x.x.x.x.x.x.' },
  { voice: 'bass', vel: 1, line: 'F#2:2 F#3:2 .:2 F#2:2 C#2:2 F#2:2 .:2 F#3:2 E2:2 E3:2 .:2 E2:2 B1:2 E2:2 .:2 E3:2 D2:2 D3:2 .:2 D2:2 A2:2 D2:2 .:2 D3:2 C#2:2 C#3:2 .:2 B1:2 C#2:4 F#2:4' },
  { voice: 'pad', vel: 0.35, line: 'F#3+C#4:16 E3+B3:16 D3+A3:16 C#3+F#3:16' },
  { voice: 'arp', vel: 0.72, line: 'F#4:2 A4:2 C#5:2 F#5:2 A4:2 C#5:2 F#5:2 C#5:2 E4:2 G#4:2 B4:2 E5:2 G#4:2 B4:2 E5:2 B4:2 D4:2 F#4:2 A4:2 D5:2 F#4:2 A4:2 D5:2 A4:2 C#5:2 A4:2 F#4:2 E4:2 C#4:2 E4:2 F#4:4' },
  { voice: 'lead', vel: 0.55, line: '.:4 C#5:4 .:2 E5:2 F#5:4 .:4 B4:4 .:2 G#4:2 E5:4 .:4 A4:4 D5:4 A4:4 F#5:4 E5:2 C#5:2 F#4:8' },
]);

export const SCORES: Record<MusicId, Score> = {
  menu: MENU,
  coast: COAST,
  desert: DESERT,
  mountain: MOUNTAIN,
  city: CITY,
};

export function musicForTrack(id: string): MusicId {
  if (Object.prototype.hasOwnProperty.call(SCORES, id)) return id as MusicId;
  return 'menu';
}

// Kept low so the loop stays behind the bike. The settings slider scales these.
const VOICE_GAIN: Record<Voice, number> = {
  kick: 0.08,
  snare: 0.034,
  hat: 0.016,
  bass: 0.04,
  pad: 0.012,
  lead: 0.02,
  arp: 0.015,
};

/**
 * Plays one looping score. Call `attach` once the audio context is running
 * (phones only allow that inside a tap). Swapping scores crossfades so a
 * held pad note from the previous loop cannot click or hang.
 */
export class MusicBed {
  private ctx: AudioContext | null = null;
  private hip: BiquadFilterNode | null = null;
  private level: GainNode | null = null;
  private duck: GainNode | null = null;
  private tail: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private next = 0;
  private step = 0;
  private volume = 0.7;
  private duckTarget = 1;
  private held = false;
  private score: Score = SCORES.menu;

  attach(ctx: AudioContext, dest: AudioNode) {
    if (this.ctx) return;
    this.ctx = ctx;
    const hip = ctx.createBiquadFilter();
    hip.type = 'highpass';
    hip.frequency.value = 80;
    hip.Q.value = 0.7;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 4200;
    low.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.value = this.volume;
    const duck = ctx.createGain();
    duck.gain.value = this.duckTarget;
    hip.connect(low);
    low.connect(level);
    level.connect(duck);
    duck.connect(dest);
    this.hip = hip;
    this.level = level;
    this.duck = duck;
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.tail = this.makeTail(1);
    this.next = ctx.currentTime + 0.05;
    if (this.timer === null) this.timer = setInterval(() => this.tick(), 90);
    this.tick();
  }

  /** Stop scheduling and disconnect. Used by the extra music bed that scores a highlight clip. */
  detach() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.duck?.disconnect();
    this.ctx = null;
  }

  /** User music level, 0 (off) to 1. */
  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.level || !this.ctx) return;
    this.level.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
  }

  /** Duck while the engine is running. `speedPct` is 0..1. */
  setDrive(engineOn: boolean, speedPct: number) {
    const target = musicDuck(engineOn, speedPct);
    if (Math.abs(target - this.duckTarget) < 0.02) return;
    this.duckTarget = target;
    if (!this.duck || !this.ctx) return;
    this.duck.gain.setTargetAtTime(target, this.ctx.currentTime, engineOn ? 0.08 : 0.22);
  }

  /** Freeze the loop while the tab is hidden. The phrase resumes where it stopped. */
  setHeld(held: boolean) {
    this.held = held;
    if (!held && this.ctx) this.next = this.ctx.currentTime + 0.05;
  }

  /**
   * Switch loop. `restart` drops back to the downbeat, used when a race starts
   * so the same highway still begins with the hook.
   */
  play(id: string, restart = false) {
    const next = SCORES[musicForTrack(id)];
    if (!restart && next.id === this.score.id) return;
    this.score = next;
    this.step = 0;
    if (!this.ctx) return;
    this.next = this.ctx.currentTime + 0.05;
    if (this.tail) this.swapBus();
    this.tick();
  }

  private makeTail(gain: number) {
    const ctx = this.ctx;
    const hip = this.hip;
    if (!ctx || !hip) throw new Error('Music is not attached');
    const tail = ctx.createGain();
    tail.gain.value = gain;
    tail.connect(hip);
    return tail;
  }

  private swapBus() {
    const ctx = this.ctx;
    const old = this.tail;
    if (!ctx || !old) return;
    const t = ctx.currentTime;
    const neu = this.makeTail(0.0008);
    neu.gain.exponentialRampToValueAtTime(1, t + 0.35);
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(Math.max(0.0008, old.gain.value), t);
    old.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
    this.tail = neu;
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.dropTimer = setTimeout(() => old.disconnect(), 420);
  }

  private tick() {
    const ctx = this.ctx;
    const score = this.score;
    if (!ctx || ctx.state !== 'running' || !this.tail) return;
    if (this.held || this.volume <= 0.001) {
      this.next = ctx.currentTime + 0.05;
      return;
    }
    const stepDur = stepDuration(score.bpm);
    const now = ctx.currentTime;
    if (this.next < now - 0.05) {
      const skip = Math.ceil((now - this.next) / stepDur);
      this.step = (this.step + skip) % score.steps;
      this.next += skip * stepDur;
      if (this.next < now) this.next = now + 0.02;
    }
    const horizon = now + 0.22;
    let guard = 0;
    while (this.next < horizon && guard++ < 12) {
      // A note time in the past throws inside Web Audio, so a late step plays now.
      const when = Math.max(this.next, now + 0.005);
      const events = score.byStep[this.step];
      for (let i = 0; i < events.length; i++) this.voice(events[i], when, stepDur);
      this.step = (this.step + 1) % score.steps;
      this.next += stepDur;
    }
  }

  private voice(ev: HitEvent, time: number, stepDur: number) {
    const peak = VOICE_GAIN[ev.voice] * ev.vel;
    if (peak <= 0.001) return;
    if (ev.voice === 'kick') this.kick(time, peak);
    else if (ev.voice === 'snare') this.snare(time, peak);
    else if (ev.voice === 'hat') this.hat(time, peak);
    else if (ev.voice === 'bass') this.bass(ev.midi, ev.dur * stepDur, time, peak);
    else if (ev.voice === 'pad') this.pad(ev.midi, ev.dur * stepDur, time, peak);
    else this.melodic(ev.voice, ev.midi, ev.dur * stepDur, time, peak);
  }

  private env(param: AudioParam, time: number, dur: number, peak: number, attack: number, release: number) {
    const span = Math.max(dur, 0.04);
    const a = Math.min(Math.max(attack, 0.005), span * 0.25);
    const r = Math.min(Math.max(release, 0.015), span * 0.4);
    const p = Math.max(peak, 0.001);
    const attackEnd = time + a;
    const sustainAt = Math.max(attackEnd + 0.004, time + span - r);
    const end = Math.max(sustainAt + 0.012, time + span);
    param.setValueAtTime(0.0008, time);
    param.exponentialRampToValueAtTime(p, attackEnd);
    param.setValueAtTime(p, sustainAt);
    param.exponentialRampToValueAtTime(0.0008, end);
    return end;
  }

  private osc(type: OscillatorType, freq: number, time: number, end: number) {
    const ctx = this.ctx;
    const tail = this.tail;
    if (!ctx || !tail) return null;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0008, time);
    o.connect(g);
    g.connect(tail);
    o.start(time);
    o.stop(end + 0.05);
    return { osc: o, gain: g };
  }

  private kick(time: number, peak: number) {
    const node = this.osc('sine', 156, time, time + 0.16);
    if (!node) return;
    this.env(node.gain.gain, time, 0.12, peak, 0.004, 0.08);
    node.osc.frequency.exponentialRampToValueAtTime(52, time + 0.1);
    this.noiseBurst(time, 0.025, 1800, 0.6, peak * 0.35, 'highpass');
  }

  private snare(time: number, peak: number) {
    const node = this.osc('triangle', 196, time, time + 0.16);
    if (node) this.env(node.gain.gain, time, 0.12, peak * 0.6, 0.004, 0.08);
    this.noiseBurst(time, 0.14, 1700, 0.8, peak, 'bandpass');
  }

  private hat(time: number, peak: number) {
    this.noiseBurst(time, 0.04, 6500, 0.7, peak, 'highpass');
  }

  private noiseBurst(time: number, dur: number, freq: number, q: number, peak: number, type: BiquadFilterType) {
    const ctx = this.ctx;
    const tail = this.tail;
    const noise = this.noise;
    if (!ctx || !tail || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, time);
    f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f);
    f.connect(g);
    g.connect(tail);
    const end = this.env(g.gain, time, dur, peak, 0.003, dur * 0.6);
    src.start(time, Math.random() * 0.4);
    src.stop(end + 0.02);
  }

  private bass(midi: number, dur: number, time: number, peak: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const hold = Math.max(0.08, dur * 0.96);
    const low = this.osc('sawtooth', midiToHz(midi), time, time + hold);
    if (!low) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, time);
    filter.Q.value = 0.6;
    low.osc.disconnect();
    low.osc.connect(filter);
    filter.connect(low.gain);
    this.env(low.gain.gain, time, hold, peak, 0.008, 0.06);
    // An octave up, so phone speakers (weak under 150 Hz) still carry the bass.
    const high = this.osc('triangle', midiToHz(midi + 12), time, time + Math.min(hold, 0.2));
    if (!high) return;
    this.env(high.gain.gain, time, Math.min(hold, 0.2), peak * 0.38, 0.006, 0.05);
  }

  private pad(midi: number, dur: number, time: number, peak: number) {
    const node = this.osc('sine', midiToHz(midi), time, time + dur + 0.08);
    if (!node) return;
    this.env(node.gain.gain, time, dur * 1.02, peak, 0.09, 0.14);
  }

  private melodic(voice: Voice, midi: number, dur: number, time: number, peak: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const arp = voice === 'arp';
    const hold = Math.min(dur * (arp ? 0.82 : 0.9), arp ? 0.26 : 0.42);
    const node = this.osc(arp ? 'triangle' : 'square', midiToHz(midi), time, time + hold + 0.08);
    if (!node) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(arp ? 2400 : 1500, time);
    filter.Q.value = 0.6;
    node.osc.disconnect();
    node.osc.connect(filter);
    filter.connect(node.gain);
    this.env(node.gain.gain, time, hold, peak, 0.01, arp ? 0.05 : 0.07);
  }
}
