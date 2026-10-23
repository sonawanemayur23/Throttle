// All sounds are synthesized with Web Audio. No audio files to download.
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engOsc1: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 600;
    this.engFilter.Q.value = 4;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc1 = ctx.createOscillator();
    this.engOsc1.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc1.start();
    this.engOsc2.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  /** speedPct 0..1, on = engine audible. */
  engine(speedPct: number, on: boolean) {
    if (!this.ctx || !this.engOsc1 || !this.engOsc2 || !this.engFilter || !this.engGain) return;
    const t = this.ctx.currentTime;
    // Fake gear shifts: pitch climbs within each gear band.
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(speedPct * gears));
    const within = speedPct * gears - g;
    const f = 48 + g * 14 + within * 95;
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.03);
    this.engOsc2.frequency.setTargetAtTime(f * 0.501, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(380 + speedPct * 1600, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.05 + speedPct * 0.05 : 0, t, 0.08);
  }

  private burst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
    if (!this.ctx || !this.noise || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private thump(from: number, to: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit(strong: boolean) {
    this.thump(strong ? 180 : 220, 45, strong ? 0.22 : 0.14, strong ? 0.9 : 0.6);
    this.burst(strong ? 0.16 : 0.1, strong ? 1400 : 2200, 1.2, strong ? 0.7 : 0.45);
  }

  hurt() {
    this.thump(140, 60, 0.18, 0.6, 'triangle');
    this.burst(0.12, 900, 1, 0.5);
  }

  whiff() {
    this.burst(0.12, 3000, 0.8, 0.15, 'bandpass', 900);
  }

  knockout() {
    this.thump(120, 30, 0.6, 1);
    this.burst(0.5, 800, 0.7, 0.8, 'lowpass', 120);
    this.thump(660, 990, 0.25, 0.15, 'square');
  }

  crash() {
    this.burst(0.9, 2000, 0.5, 1, 'lowpass', 150);
    this.thump(90, 25, 0.7, 1);
  }

  nearMiss() {
    this.burst(0.35, 400, 1.5, 0.5, 'bandpass', 2600);
  }

  beep(high: boolean) {
    this.thump(high ? 880 : 440, high ? 880 : 440, high ? 0.5 : 0.18, 0.25, 'square');
  }

  coin() {
    this.thump(990, 1320, 0.12, 0.15, 'square');
  }
}
