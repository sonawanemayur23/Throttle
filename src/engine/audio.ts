// All sounds are synthesized with Web Audio. No audio files to download.
import { MusicBed } from './music';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicOut: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private tap: MediaStreamAudioDestinationNode | null = null;
  private music = new MusicBed();
  private engOsc1: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private engOsc3: OscillatorNode | null = null;
  private keepAlive: HTMLAudioElement | null = null;
  muted = false;

  /**
   * Call from every user gesture. Phones only start audio inside a tap, and
   * iOS suspends it again after a call, an app switch or a lock.
   */
  unlock() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    // A one-sample buffer played inside the gesture fully unlocks older iOS.
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    // iOS mutes Web Audio when the ring switch is on silent. A playing media
    // element moves the page to the "playback" audio session, which ignores it.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    if (!this.keepAlive) {
      try {
        const a = new Audio(silentWavUrl());
        a.loop = true;
        a.setAttribute('playsinline', '');
        a.volume = 0.01;
        this.keepAlive = a;
      } catch {
        /* media not allowed */
      }
    }
    if (this.keepAlive?.paused) void this.keepAlive.play().catch(() => undefined);
  }

  /** True once audio is actually running. */
  get running() {
    return this.ctx?.state === 'running';
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    this.ctx = ctx;
    // A compressor lifts quiet hits so they carry on small phone speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(ctx.destination);
    this.comp = comp;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp);
    // Music bypasses the compressor so the beat does not pump the engine.
    // Mute still closes this gain, same as the effects bus.
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.muted ? 0 : 1;
    this.musicOut.connect(ctx.destination);
    this.music.attach(ctx, this.musicOut);

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
    // Phone speakers barely play below 150 Hz, so add an upper harmonic.
    this.engOsc3 = ctx.createOscillator();
    this.engOsc3.type = 'square';
    const g3 = ctx.createGain();
    g3.gain.value = 0.35;
    this.engOsc3.connect(g3);
    g3.connect(this.engFilter);
    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc1.start();
    this.engOsc2.start();
    this.engOsc3.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.02);
    if (this.musicOut) this.musicOut.gain.setTargetAtTime(m ? 0 : 1, t, 0.02);
  }

  /** The live audio context, once sound has started. Highlight clips mix music into it. */
  get audioContext() {
    return this.ctx;
  }

  /** Everything the player hears (effects and music) as a stream, for highlight clips. */
  gameAudioStream(): MediaStream | null {
    const ctx = this.ctx;
    if (!ctx || !this.comp || !this.musicOut || typeof ctx.createMediaStreamDestination !== 'function') return null;
    if (!this.tap) {
      this.tap = ctx.createMediaStreamDestination();
      this.comp.connect(this.tap);
      this.musicOut.connect(this.tap);
    }
    return this.tap.stream;
  }

  /** Music level 0..1. 0 leaves the bike audible and drops the loop. */
  setMusicVolume(v: number) {
    this.music.setVolume(v);
  }

  /** `restart` begins at the downbeat. Used when a race starts. */
  playMusic(id: string, restart = false) {
    this.music.play(id, restart);
  }

  /** Pause the loop while the tab is hidden, then resume the same phrase. */
  setMusicHeld(held: boolean) {
    this.music.setHeld(held);
  }

  /** speedPct 0..1, on = engine audible. */
  engine(speedPct: number, on: boolean) {
    this.music.setDrive(on, speedPct);
    if (!this.ctx || !this.engOsc1 || !this.engOsc2 || !this.engOsc3 || !this.engFilter || !this.engGain) return;
    const t = this.ctx.currentTime;
    // Fake gear shifts: pitch climbs within each gear band.
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(speedPct * gears));
    const within = speedPct * gears - g;
    const f = 48 + g * 14 + within * 95;
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.03);
    this.engOsc2.frequency.setTargetAtTime(f * 0.501, t, 0.03);
    this.engOsc3.frequency.setTargetAtTime(f * 3.01, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(700 + speedPct * 1900, t, 0.05);
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
    // Low thumps vanish on phone speakers; a short layer two octaves up keeps the punch.
    if (from < 400) this.tone(from * 4, to * 4, Math.min(dur, 0.12), vol * 0.35, 'triangle');
    this.tone(from, to, dur, vol, type);
  }

  private tone(from: number, to: number, dur: number, vol: number, type: OscillatorType) {
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

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  /** Two-tone police siren. vol 0..1, 0 turns it off. */
  siren(vol: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    if (!this.sirenOsc) {
      if (vol <= 0) return;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2400;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(this.master);
      o.start();
      this.sirenOsc = o;
      this.sirenGain = g;
    }
    // Alternate between two tones twice a second.
    const hi = Math.floor(t * 2.2) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, t, 0.02);
    this.sirenGain?.gain.setTargetAtTime(vol * 0.06, t, 0.08);
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

/** A short silent WAV, used to hold the iOS playback audio session. */
let silentUrl: string | null = null;
function silentWavUrl() {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, str: string) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}
