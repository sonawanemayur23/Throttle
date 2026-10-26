// GameHost owns the canvas, the game loop, input and sound. React screens sit
// on top and talk to it through this small API. Keeping the loop out of React
// means a React re-render can never drop a frame.

import { Sound } from '../engine/audio';
import { setButtonIcon } from './uiArt';
import { Game, WEAPONS, type RaceSetup, type Results } from '../engine/game';
import { Input, type Btn } from '../engine/input';
import { Renderer } from '../engine/render';
import { MomentTracker, type Moment } from '../engine/replay';
import type { Scene } from './film';

type Listener<T> = (v: T) => void;

export class GameHost {
  readonly sound = new Sound();
  readonly input = new Input();
  readonly game: Game;
  private renderer: Renderer;
  private paused = false;
  private hidden = false;
  private last = performance.now();

  // Auto quality (P2-15): time the first 3 seconds of racing, and if the
  // median frame takes longer than 18 ms, switch to low quality for good.
  private autoQuality = false;
  private samples: number[] = [];
  private raceClock = 0;
  /** Called once when auto quality decides this device needs low quality. */
  onQualityDrop: (() => void) | null = null;
  private readonly slowTest = new URLSearchParams(location.search).has('slow');
  private finishedAt = 0;
  private reported = false;
  private shownWeapon: string | null = null;
  private touchEl = document.getElementById('touch');
  private punchBtn = document.getElementById('punchBtn');

  onFinish: Listener<Results> | null = null;
  /** Share Moments: the race's best moments, a few seconds after the finish. */
  onMoments: ((moments: Moment[], scene: Scene) => void) | null = null;
  private tracker = new MomentTracker();
  private momentsSent = true;
  onPauseChange: Listener<boolean> | null = null;
  onMuteToggle: (() => void) | null = null;
  onConfirm: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, attract: RaceSetup) {
    this.renderer = new Renderer(canvas);
    this.game = new Game(this.sound, this.input, attract);
    if (this.input.touch) document.body.classList.add('touch');

    // Phones allow audio only from inside a gesture, and iOS can suspend it later.
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click'] as const) {
      window.addEventListener(ev, () => this.sound.unlock(), { capture: true, passive: true });
    }
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('touchstart', () => this.showTouch(), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.isTrusted) this.touchEl?.classList.add('hidden');
    });
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.sound.setMusicHeld(this.hidden);
      if (this.hidden) {
        this.sound.engine(0, false);
        this.sound.siren(0);
        if (this.racing) this.setPaused(true);
      }
      this.last = performance.now();
    });
    // Icons from the Prompt 8 art in the touch and top bar buttons.
    setButtonIcon(document.querySelector('.b-punch'), 'punch', 'PUNCH');
    setButtonIcon(document.querySelector('.b-kick'), 'kick', 'KICK');
    setButtonIcon(document.querySelector('.b-brake'), 'brake', 'BRAKE');
    setButtonIcon(document.getElementById('pauseBtn'), 'pause');
    setButtonIcon(document.getElementById('mute'), 'sound-on');
    document.getElementById('pauseBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setPaused(true);
    });
    document.getElementById('mute')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onMuteToggle?.();
    });
    this.input.onMute = () => this.onMuteToggle?.();
    this.input.onPause = () => {
      if (this.racing) this.setPaused(!this.paused);
    };
    this.input.onConfirm = () => this.onConfirm?.();

    requestAnimationFrame(this.frame);
  }

  get racing() {
    return this.game.phase === 'race' || this.game.phase === 'countdown';
  }

  get isPaused() {
    return this.paused;
  }

  setMuted(m: boolean) {
    this.sound.muted = m;
    this.sound.setMuted(m);
    const btn = document.getElementById('mute');
    if (btn) {
      setButtonIcon(btn, m ? 'sound-off' : 'sound-on');
      btn.setAttribute('aria-pressed', String(m));
    }
  }

  setMusicVolume(v: number) {
    this.sound.setMusicVolume(v);
  }

  /** Apply the comfort settings: shake, buzz and which keys drive the bike. */
  applyComfort(settings: { reduceMotion: boolean; vibration: boolean; keys: Record<Btn, string[]> }) {
    this.game.reduceMotion = settings.reduceMotion;
    this.game.vibration = settings.vibration;
    this.input.vibration = settings.vibration;
    this.input.setBindings(settings.keys);
  }

  /**
   * Graphics quality from Settings. 'auto' starts high and measures each race
   * until it finds the device too slow; `lowDetected` remembers that it did.
   */
  applyQuality(choice: 'auto' | 'high' | 'low', lowDetected: boolean) {
    this.autoQuality = choice === 'auto' && !lowDetected;
    this.renderer.quality = choice === 'low' || (choice === 'auto' && lowDetected) ? 'low' : 'high';
  }

  /** The next key press goes to Settings instead of the race. */
  listenForKey(fn: (code: string) => void) {
    this.input.listenForKey(fn);
  }

  cancelListen() {
    this.input.cancelListen();
  }

  /** Drive a demo lap behind the menus. */
  attract(setup: RaceSetup) {
    this.sendMoments();
    this.paused = false;
    document.body.classList.remove('racing');
    this.touchEl?.classList.add('hidden');
    this.sound.engine(0, false);
    this.sound.siren(0);
    this.sound.playMusic('menu');
    this.game.setAttract(setup);
  }

  startRace(setup: RaceSetup) {
    this.sound.unlock();
    this.sound.playMusic(setup.track.id, true);
    this.paused = false;
    this.reported = false;
    document.body.classList.add('racing');
    this.game.start(setup);
    this.tracker.reset();
    this.momentsSent = false;
    this.showTouch();
    this.last = performance.now();
    this.samples = [];
    this.raceClock = 0;
  }

  setPaused(p: boolean) {
    if (!this.racing || p === this.paused) return;
    this.paused = p;
    this.input.releaseAll();
    if (p) {
      this.sound.engine(0, false);
      this.sound.siren(0);
      this.touchEl?.classList.add('hidden');
    } else {
      this.showTouch();
      this.last = performance.now();
    }
    this.onPauseChange?.(p);
  }

  private showTouch() {
    if (this.input.lastTouch && this.racing && !this.paused) this.touchEl?.classList.remove('hidden');
  }

  /** Hand over the race's moments once (early if the player leaves before the aftermath is filmed). */
  private sendMoments() {
    if (this.momentsSent) return;
    this.momentsSent = true;
    const g = this.game;
    if (g.phase !== 'finished') return;
    this.onMoments?.(this.tracker.finish(), { setup: g.setup, track: g.track, L: g.L });
  }

  /** Collect frame gaps over the first 3 seconds of racing, then decide once. */
  private measure(gap: number) {
    if (!this.autoQuality || this.hidden || this.paused || this.game.phase !== 'race') return;
    if (gap > 1000) return; // a tab switch or a long stall, not a frame
    this.raceClock += gap;
    if (this.raceClock < 500) return; // let the race settle first
    this.samples.push(gap);
    if (this.raceClock < 3500) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    this.autoQuality = false;
    if (median > 18) {
      this.renderer.quality = 'low';
      this.onQualityDrop?.();
    }
    if (new URLSearchParams(location.search).has('debug')) console.log(`auto quality: median ${median.toFixed(1)} ms, ${this.renderer.quality}`);
  }

  /** Keep the weapon button in step with what the player holds. */
  private syncWeapon() {
    const w = this.game.player.weapon;
    if (w === this.shownWeapon) return;
    this.shownWeapon = w;
    document.body.classList.toggle('has-weapon', !!w);
    // Armed: the punch zone swings the weapon. Unarmed: back to punch.
    if (this.punchBtn) {
      this.punchBtn.dataset.btn = w ? 'weapon' : 'punch';
      this.punchBtn.setAttribute('aria-label', w ? `Swing ${WEAPONS[w].label.toLowerCase()}` : 'Punch');
      setButtonIcon(this.punchBtn, w ?? 'punch', w ? WEAPONS[w].label : 'PUNCH');
    }
  }

  private frame = (now: number) => {
    const gap = now - this.last;
    const dt = Math.min(0.05, gap / 1000);
    this.last = now;
    if (this.slowTest) {
      // ?slow: burn 25 ms a frame to test auto quality on a fast machine.
      const until = performance.now() + 25;
      while (performance.now() < until) {
        /* busy */
      }
    }
    this.measure(gap);
    this.input.poll();
    if (!this.hidden && !this.paused) {
      const was = this.game.phase;
      this.game.update(dt);
      if (this.game.phase === 'finished' && was !== 'finished') {
        this.finishedAt = now;
        this.tracker.finished(this.game);
      }
      // Before the render, which clears the frame's hit events.
      if (!this.momentsSent) {
        this.tracker.observe(this.game);
        if (this.game.phase === 'finished' && !this.tracker.filming) this.sendMoments();
      }
      if (this.game.phase === 'finished' && !this.reported && now - this.finishedAt > 1600 && this.game.results) {
        this.reported = true;
        document.body.classList.remove('racing');
        this.touchEl?.classList.add('hidden');
        this.sound.engine(0, false);
        this.sound.siren(0);
        this.sound.playMusic('menu');
        this.onFinish?.(this.game.results);
      }
      this.syncWeapon();
      this.renderer.render(this.game, dt);
    }
    requestAnimationFrame(this.frame);
  };
}
