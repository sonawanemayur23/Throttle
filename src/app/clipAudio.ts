// Share Moments, sound. Each style gets a short track written for a 10 second
// clip, rendered offline so the drop lands exactly on the hit frame. All of it
// is synthesized here: no recordings, nothing to license, safe on Instagram.
//
//   Hype  - synthwave: a hook over four chords, a riser, a hard gap, a boom on
//           the impact, a half-time slow-motion section, a final stab.
//   Funny - a bouncy tuba and plucks, a record scratch on the hit, a freeze,
//           a slide whistle in slow motion, a bonk, a "ta-da".
//   Clean - no music: the engine, the hits and the crash, louder and clearer.

export type ClipStyle = 'hype' | 'funny' | 'clean';

export interface SoundCue {
  /** Output time in seconds. */
  t: number;
  kind: 'punch' | 'crash' | 'whoosh';
  /** Playback speed at that moment: 1 normal, below 1 slow motion. */
  rate: number;
}

export interface AudioPlan {
  style: ClipStyle;
  total: number;
  /** Output time of the hit. */
  impact: number;
  /** Output time the end card starts. */
  end: number;
  /** Output span of the slow motion, if any. */
  slow: [number, number] | null;
  /** Output span of a freeze frame, if any. */
  freeze: [number, number] | null;
  cues: SoundCue[];
  /** Player speed in km/h at output time t, for the engine. */
  speed: (t: number) => number;
}

export const SAMPLE_RATE = 48000;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Render the plan's sound to a stereo buffer. */
export async function renderClipAudio(plan: AudioPlan): Promise<AudioBuffer> {
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const oc = new OAC(2, Math.ceil(plan.total * SAMPLE_RATE), SAMPLE_RATE);
  const s = new Synth(oc);
  if (plan.style === 'hype') hype(s, plan);
  else if (plan.style === 'funny') funny(s, plan);
  else clean(s, plan);
  sfx(s, plan, plan.style === 'clean' ? 1 : 0.55);
  engine(s, plan, plan.style === 'clean' ? 0.22 : plan.style === 'hype' ? 0.07 : 0.05);
  return oc.startRendering();
}

/** Small synth kit on an offline context. Every voice starts and ends at silence: no clicks. */
class Synth {
  readonly out: GainNode;
  readonly music: GainNode;
  readonly fx: GainNode;
  private noiseBuf: AudioBuffer;
  constructor(readonly ac: BaseAudioContext) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ac.destination);
    this.out = ac.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(comp);
    this.music = ac.createGain();
    this.music.connect(this.out);
    this.fx = ac.createGain();
    this.fx.connect(this.out);
    this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  private noise(t: number, dur: number, dest: AudioNode) {
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  osc(type: OscillatorType, t: number, freq: number, dur: number, dest: AudioNode, detune = 0) {
    const o = this.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  kick(t: number, vel = 1, bus = this.music) {
    const g = this.ac.createGain();
    g.connect(bus);
    this.env(g, t, 0.9 * vel, 0.003, 0.02, 0.32);
    const o = this.osc('sine', t, 150, 0.4, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  }

  snare(t: number, vel = 1, bus = this.music) {
    const g = this.ac.createGain();
    const hp = this.ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    hp.connect(g);
    g.connect(bus);
    this.env(g, t, 0.5 * vel, 0.002, 0.01, 0.18);
    this.noise(t, 0.25, hp);
    const tg = this.ac.createGain();
    tg.connect(bus);
    this.env(tg, t, 0.3 * vel, 0.002, 0.01, 0.08);
    this.osc('triangle', t, 190, 0.12, tg);
  }

  hat(t: number, vel = 1, open = false) {
    const g = this.ac.createGain();
    const hp = this.ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    hp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.16 * vel, 0.001, 0.005, open ? 0.22 : 0.045);
    this.noise(t, open ? 0.3 : 0.08, hp);
  }

  bass(t: number, midi: number, dur: number, vel = 1) {
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + Math.min(dur, 0.3));
    lp.Q.value = 6;
    lp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.42 * vel, 0.004, Math.max(0, dur - 0.08), 0.06);
    this.osc('sawtooth', t, midiHz(midi), dur, lp);
    this.osc('sine', t, midiHz(midi - 12), dur, g);
  }

  lead(t: number, midi: number, dur: number, vel = 1) {
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    lp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.16 * vel, 0.01, Math.max(0, dur - 0.1), 0.18);
    // Two detuned saws and a square: the 80s synth lead.
    this.osc('sawtooth', t, midiHz(midi), dur + 0.2, lp, -8);
    this.osc('sawtooth', t, midiHz(midi), dur + 0.2, lp, 8);
    this.osc('square', t, midiHz(midi + 12), dur + 0.2, lp).detune.value = 3;
  }

  pad(t: number, midis: number[], dur: number, vel = 1) {
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(2200, t + dur * 0.6);
    lp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.13 * vel, 0.08, Math.max(0, dur - 0.4), 0.5);
    for (const m of midis) {
      this.osc('sawtooth', t, midiHz(m), dur + 0.6, lp, -6);
      this.osc('sawtooth', t, midiHz(m), dur + 0.6, lp, 6);
    }
  }

  pluck(t: number, midi: number, vel = 1) {
    const g = this.ac.createGain();
    g.connect(this.music);
    this.env(g, t, 0.28 * vel, 0.002, 0.01, 0.28);
    this.osc('sine', t, midiHz(midi), 0.35, g);
    const g2 = this.ac.createGain();
    g2.connect(this.music);
    this.env(g2, t, 0.08 * vel, 0.002, 0.005, 0.12);
    this.osc('triangle', t, midiHz(midi + 12), 0.2, g2);
  }

  tuba(t: number, midi: number, dur: number, vel = 1) {
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.4 * vel, 0.03, Math.max(0, dur - 0.12), 0.1);
    this.osc('sawtooth', t, midiHz(midi), dur, lp);
  }

  riser(t0: number, t1: number, vel = 1) {
    const g = this.ac.createGain();
    const bp = this.ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(400, t0);
    bp.frequency.exponentialRampToValueAtTime(9000, t1);
    bp.connect(g);
    g.connect(this.music);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35 * vel, t1 - 0.02);
    g.gain.linearRampToValueAtTime(0, t1);
    this.noise(t0, t1 - t0, bp);
  }

  boom(t: number) {
    const g = this.ac.createGain();
    g.connect(this.music);
    this.env(g, t, 1, 0.004, 0.1, 1.4);
    const o = this.osc('sine', t, 90, 1.6, g);
    o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    this.cymbal(t, 1.6);
  }

  cymbal(t: number, len = 1.2, vel = 1) {
    const g = this.ac.createGain();
    const hp = this.ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5000, t);
    hp.frequency.exponentialRampToValueAtTime(2500, t + len);
    hp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.3 * vel, 0.002, 0.03, len);
    this.noise(t, len + 0.1, hp);
  }

  scratch(t: number) {
    const g = this.ac.createGain();
    const bp = this.ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 4;
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.linearRampToValueAtTime(3500, t + 0.09);
    bp.frequency.linearRampToValueAtTime(600, t + 0.2);
    bp.frequency.linearRampToValueAtTime(2800, t + 0.3);
    bp.frequency.linearRampToValueAtTime(400, t + 0.45);
    bp.connect(g);
    g.connect(this.music);
    this.env(g, t, 0.7, 0.005, 0.38, 0.06);
    this.noise(t, 0.5, bp);
  }

  slideWhistle(t0: number, t1: number) {
    const g = this.ac.createGain();
    g.connect(this.music);
    this.env(g, t0, 0.22, 0.05, t1 - t0 - 0.15, 0.1);
    const o = this.osc('sine', t0, 1500, t1 - t0, g);
    o.frequency.exponentialRampToValueAtTime(320, t1);
    const lfo = this.osc('sine', t0, 6, t1 - t0, this.ac.createGain());
    const depth = this.ac.createGain();
    depth.gain.value = 18;
    lfo.disconnect();
    lfo.connect(depth);
    depth.connect(o.frequency);
  }

  bonk(t: number) {
    const g = this.ac.createGain();
    g.connect(this.music);
    this.env(g, t, 0.55, 0.002, 0.02, 0.22);
    const o = this.osc('triangle', t, 520, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.2);
  }

  // Effects, slowed with the picture: lower and longer below rate 1.
  punch(t: number, rate: number, vel: number) {
    const k = Math.max(0.35, rate);
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800 * k;
    lp.connect(g);
    g.connect(this.fx);
    this.env(g, t, 0.9 * vel, 0.002, 0.02 / k, 0.12 / k);
    this.noise(t, 0.2 / k, lp);
    const tg = this.ac.createGain();
    tg.connect(this.fx);
    this.env(tg, t, 0.8 * vel, 0.002, 0.02, 0.14 / k);
    const o = this.osc('sine', t, 130 * k, 0.25 / k, tg);
    o.frequency.exponentialRampToValueAtTime(55 * k, t + 0.12 / k);
  }

  crash(t: number, rate: number, vel: number) {
    const k = Math.max(0.35, rate);
    const g = this.ac.createGain();
    const lp = this.ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200 * k, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.9 / k);
    lp.connect(g);
    g.connect(this.fx);
    this.env(g, t, 0.85 * vel, 0.003, 0.08, 0.9 / k);
    this.noise(t, 1.1 / k, lp);
    // Metal on tarmac.
    for (let i = 0; i < 4; i++) {
      const mg = this.ac.createGain();
      mg.connect(this.fx);
      const tt = t + (i * 0.11) / k;
      this.env(mg, tt, 0.18 * vel, 0.001, 0.01, 0.09 / k);
      this.osc('square', tt, (420 - i * 60) * k, 0.12 / k, mg);
    }
  }

  whoosh(t: number, vel: number) {
    const g = this.ac.createGain();
    const bp = this.ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    bp.connect(g);
    g.connect(this.fx);
    this.env(g, t, 0.35 * vel, 0.08, 0.1, 0.32);
    this.noise(t, 0.55, bp);
  }
}

// Am - F - C - G, the four chords of a thousand synthwave tracks.
const CHORDS = [
  { root: 45, notes: [57, 60, 64] },
  { root: 41, notes: [53, 57, 60] },
  { root: 48, notes: [55, 60, 64] },
  { root: 43, notes: [55, 59, 62] },
];
// The hook: rises, turns, lands home. Eight notes, easy to hum.
const HOOK = [69, 72, 76, 74, 72, 69, 67, 69];

function hype(s: Synth, p: AudioPlan) {
  const beat = 0.5;
  const drop = p.impact;
  // Build up: four on the floor, offbeat hats, eighth-note bass through the chords.
  for (let t = 0, i = 0; t < drop - 0.25; t += beat, i++) {
    s.kick(t, i === 0 ? 1 : 0.85);
    s.hat(t + beat / 2, 0.8);
    if (i % 2 === 1) s.snare(t, 0.7);
    const c = CHORDS.at(Math.floor(i / 2) % 4) ?? CHORDS[0];
    s.bass(t, c.root, 0.22, 0.9);
    s.bass(t + beat / 2, c.root + 12, 0.2, 0.75);
  }
  // The first half of the hook, then a riser into a hard gap.
  for (let i = 0; i < 4; i++) s.lead(drop - 2 + i * beat * 0.75, HOOK.at(i) ?? 69, beat * 0.7, 0.8);
  s.riser(drop - 1.6, drop - 0.2, 1);
  // The hit.
  s.boom(drop);
  s.kick(drop, 1.2);
  s.pad(drop, (CHORDS.at(0) ?? CHORDS[0]).notes, 1.2, 1.2);
  // Slow motion: half time, big chords, the whole hook.
  const slowEnd = p.slow ? p.slow[1] : drop + 4;
  const bar = (slowEnd - drop) / 4;
  for (let i = 0; i < 4; i++) {
    const t = drop + i * bar;
    const c = CHORDS.at(i) ?? CHORDS[0];
    if (i > 0) s.pad(t, c.notes, bar, 1);
    s.bass(t, c.root, bar * 0.95, 1);
    s.kick(t, i === 0 ? 0 : 1);
    s.snare(t + bar / 2, 0.9);
    s.hat(t + bar / 4, 0.5, true);
    s.hat(t + (3 * bar) / 4, 0.5, true);
  }
  const step = (slowEnd - drop) / HOOK.length;
  HOOK.forEach((m, i) => s.lead(drop + 0.15 + i * step, m, step * 0.9, 1));
  // Back to full speed, a snare roll into the end card.
  for (let t = slowEnd, i = 0; t < p.end - 0.01; t += beat / 2, i++) {
    if (i % 2 === 0) s.kick(t, 0.9);
    s.hat(t + beat / 4, 0.7);
    s.bass(t, 45 + (i % 2) * 12, 0.2, 0.8);
  }
  for (let t = p.end - 0.5; t < p.end - 0.01; t += 0.0625) s.snare(t, 0.35 + (t - (p.end - 0.5)));
  // The end card: one big stab and a cymbal.
  s.kick(p.end, 1.1);
  s.pad(p.end, [57, 60, 64, 69], 0.7, 1.3);
  s.bass(p.end, 45, 0.6, 1);
  s.cymbal(p.end, 1.1, 0.8);
}

// C major, bouncy: tuba on the beat, plucks on top.
const SILLY = [72, 76, 79, 76, 77, 74, 71, 67, 72, 76, 79, 84];

function funny(s: Synth, p: AudioPlan) {
  const beat = 0.42;
  const hit = p.impact;
  for (let t = 0, i = 0; t < hit - 0.05; t += beat, i++) {
    s.tuba(t, i % 2 === 0 ? 36 : 43, beat * 0.6, 0.9);
    s.hat(t + beat / 2, 0.6);
    s.pluck(t + (i % 2 ? beat / 2 : 0), SILLY.at(i % SILLY.length) ?? 72, 0.9);
  }
  // Needle off the record.
  s.scratch(hit);
  // The freeze: one deadpan low note.
  const [f0, f1] = p.freeze ?? [hit, hit + 0.8];
  s.tuba(f0 + 0.3, 31, f1 - f0 - 0.3, 1);
  // Slow motion: the slide whistle falls with the rider.
  const [s0, s1] = p.slow ?? [f1, f1 + 2.4];
  s.slideWhistle(s0, s1 - 0.1);
  s.tuba(s0, 36, 0.5, 0.7);
  s.tuba(s0 + 0.9, 35, 0.5, 0.7);
  s.tuba(s0 + 1.8, 34, 0.5, 0.7);
  s.bonk(s1);
  // Back to the bounce, then a little "ta-da".
  for (let t = s1 + 0.2, i = 0; t < p.end - 0.1; t += beat, i++) {
    s.tuba(t, i % 2 === 0 ? 36 : 43, beat * 0.6, 0.7);
    s.hat(t + beat / 2, 0.5);
  }
  s.pluck(p.end, 79, 1.1);
  s.pluck(p.end + 0.22, 84, 1.2);
  s.tuba(p.end + 0.22, 36, 0.5, 0.8);
}

function clean(s: Synth, p: AudioPlan) {
  // No music: one whoosh into the end card and a soft low note under it.
  s.whoosh(p.end - 0.25, 0.8);
  s.pad(p.end, [45, 52, 57], 0.9, 0.6);
}

function sfx(s: Synth, p: AudioPlan, vel: number) {
  for (const c of p.cues) {
    if (c.t >= p.end) continue;
    if (c.kind === 'punch') s.punch(c.t, c.rate, vel);
    else if (c.kind === 'crash') s.crash(c.t, c.rate, vel);
    else s.whoosh(c.t, vel * 0.7);
  }
}

/** The bike, its pitch following the replay's speed, lower in slow motion. */
function engine(s: Synth, p: AudioPlan, level: number) {
  const ac = s.ac;
  const g = ac.createGain();
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(g);
  g.connect(s.fx);
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(level, 0.15);
  g.gain.setValueAtTime(level, Math.max(0.2, p.end - 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, p.end);
  const steps = Math.ceil(p.end * 20);
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * p.end;
    const slow = p.slow && t >= p.slow[0] && t < p.slow[1] ? 0.55 : p.freeze && t >= p.freeze[0] && t < p.freeze[1] ? 0.3 : 1;
    curve[i] = (48 + p.speed(t) * 0.55) * slow;
  }
  const a = s.osc('sawtooth', 0, curve[0] || 60, p.end, lp);
  const b = s.osc('square', 0, (curve[0] || 60) * 0.5, p.end, lp);
  a.frequency.setValueCurveAtTime(curve, 0, p.end);
  b.frequency.setValueCurveAtTime(curve.map((f) => f * 0.5), 0, p.end);
}
