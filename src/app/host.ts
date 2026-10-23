// GameHost owns the canvas, the game loop, input and sound. React screens sit
// on top and talk to it through this small API. Keeping the loop out of React
// means a React re-render can never drop a frame.

import { Sound } from '../engine/audio';
import { Game, WEAPONS, type RaceSetup, type Results } from '../engine/game';
import { Input } from '../engine/input';
import { Renderer } from '../engine/render';

type Listener<T> = (v: T) => void;

export class GameHost {
  readonly sound = new Sound();
  readonly input = new Input();
  readonly game: Game;
  private renderer: Renderer;
  private paused = false;
  private hidden = false;
  private last = performance.now();
  private finishedAt = 0;
  private reported = false;
  private shownWeapon: string | null = null;
  private touchEl = document.getElementById('touch');
  private weaponBtn = document.getElementById('weaponBtn');

  onFinish: Listener<Results> | null = null;
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
      if (this.hidden) {
        this.sound.engine(0, false);
        this.sound.siren(0);
        if (this.racing) this.setPaused(true);
      }
      this.last = performance.now();
    });
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
      btn.textContent = m ? '\u{1F507}' : '\u{1F50A}';
      btn.setAttribute('aria-pressed', String(m));
    }
  }

  /** Drive a demo lap behind the menus. */
  attract(setup: RaceSetup) {
    this.paused = false;
    document.body.classList.remove('racing');
    this.touchEl?.classList.add('hidden');
    this.game.setAttract(setup);
  }

  startRace(setup: RaceSetup) {
    this.sound.unlock();
    this.paused = false;
    this.reported = false;
    document.body.classList.add('racing');
    this.game.start(setup);
    this.showTouch();
    this.last = performance.now();
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

  /** Keep the weapon button in step with what the player holds. */
  private syncWeapon() {
    const w = this.game.player.weapon;
    if (w === this.shownWeapon) return;
    this.shownWeapon = w;
    document.body.classList.toggle('has-weapon', !!w);
    if (w && this.weaponBtn) this.weaponBtn.textContent = WEAPONS[w].label;
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.input.poll();
    if (!this.hidden && !this.paused) {
      const was = this.game.phase;
      this.game.update(dt);
      if (this.game.phase === 'finished' && was !== 'finished') this.finishedAt = now;
      if (this.game.phase === 'finished' && !this.reported && now - this.finishedAt > 1600 && this.game.results) {
        this.reported = true;
        document.body.classList.remove('racing');
        this.touchEl?.classList.add('hidden');
        this.sound.siren(0);
        this.onFinish?.(this.game.results);
      }
      this.syncWeapon();
      this.renderer.render(this.game, dt);
    }
    requestAnimationFrame(this.frame);
  };
}
