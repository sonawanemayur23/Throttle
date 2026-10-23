export type Btn = 'left' | 'right' | 'up' | 'down' | 'punch' | 'kick' | 'weapon';

const KEYMAP: Record<string, Btn> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyJ: 'punch',
  KeyZ: 'punch',
  KeyK: 'kick',
  KeyX: 'kick',
  KeyL: 'weapon',
  KeyC: 'weapon',
};

export class Input {
  private held = new Set<Btn>();
  private touchHeld = new Set<Btn>();
  private pressed = new Set<Btn>();
  private touchAxis = 0;
  readonly touch: boolean;
  /** Last input came from the screen, not the keyboard. */
  lastTouch: boolean;
  onConfirm: (() => void) | null = null;
  onMute: (() => void) | null = null;
  onPause: (() => void) | null = null;

  constructor() {
    this.touch = window.matchMedia('(pointer: coarse)').matches;
    this.lastTouch = this.touch;

    window.addEventListener('keydown', (e) => {
      if (e.isTrusted) {
        this.lastTouch = false;
        document.body.classList.remove('touch');
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.onConfirm?.();
        return;
      }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        this.onPause?.();
        return;
      }
      if (e.code === 'KeyM' && !e.repeat) this.onMute?.();
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!this.held.has(b)) this.pressed.add(b);
      this.held.add(b);
    });
    window.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) this.held.delete(b);
    });
    window.addEventListener(
      'touchstart',
      () => {
        this.lastTouch = true;
        document.body.classList.add('touch');
      },
      { passive: true },
    );
    window.addEventListener('blur', () => this.releaseAll());

    this.bindButtons();
    this.bindSteerPad();
  }

  /** Fight and brake buttons: one finger per button, multi-touch safe. */
  private bindButtons() {
    document.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
      const b = el.dataset.btn as Btn;
      const active = new Set<number>();
      const down = (e: PointerEvent) => {
        e.preventDefault();
        this.lastTouch = true;
        active.add(e.pointerId);
        if (!this.touchHeld.has(b)) this.pressed.add(b);
        this.touchHeld.add(b);
        el.classList.add('on');
        try {
          navigator.vibrate?.(8);
        } catch {
          /* not allowed */
        }
      };
      const up = (e: PointerEvent) => {
        active.delete(e.pointerId);
        if (active.size === 0) {
          this.touchHeld.delete(b);
          el.classList.remove('on');
        }
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  /**
   * Steering pad: hold anywhere on it. Left of center steers left, right of
   * center steers right, and how far you slide sets how hard you turn.
   */
  private bindSteerPad() {
    const pad = document.getElementById('steerPad');
    if (!pad) return;
    const apply = (clientX: number) => {
      const r = pad.getBoundingClientRect();
      const t = (clientX - (r.left + r.width / 2)) / (r.width * 0.3);
      let a = Math.max(-1, Math.min(1, t));
      if (Math.abs(a) < 0.12) a = 0;
      this.touchAxis = a;
      pad.style.setProperty('--knob', String(Math.max(-1, Math.min(1, t)) * 0.5 + 0.5));
      pad.classList.add('on');
      pad.classList.toggle('l', a < 0);
      pad.classList.toggle('r', a > 0);
    };
    const reset = () => {
      this.touchAxis = 0;
      pad.classList.remove('l', 'r', 'on');
      pad.style.setProperty('--knob', '0.5');
    };

    // Fingers: follow the touch that started on the pad, wherever it slides.
    let touchId: number | null = null;
    const findTouch = (list: TouchList) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === touchId) return list[i];
      return null;
    };
    pad.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.lastTouch = true;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      apply(t.clientX);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (touchId === null) return;
      const t = findTouch(e.touches);
      if (t) apply(t.clientX);
    }, { passive: true });
    const touchEnd = (e: TouchEvent) => {
      if (touchId === null || !findTouch(e.changedTouches)) return;
      touchId = null;
      reset();
    };
    window.addEventListener('touchend', touchEnd);
    window.addEventListener('touchcancel', touchEnd);

    // Mouse or pen, for testing on a laptop.
    let mouseDown = false;
    pad.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      mouseDown = true;
      apply(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
      if (mouseDown && e.pointerType !== 'touch') apply(e.clientX);
    });
    window.addEventListener('pointerup', (e) => {
      if (!mouseDown || e.pointerType === 'touch') return;
      mouseDown = false;
      reset();
    });
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  releaseAll() {
    this.held.clear();
    this.touchHeld.clear();
    this.touchAxis = 0;
    document.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
  }

  isDown(b: Btn) {
    return this.held.has(b) || this.touchHeld.has(b);
  }

  /** Steering from -1 (full left) to 1 (full right). */
  axis() {
    if (this.touchAxis !== 0) return this.touchAxis;
    return (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
  }

  /** True once per press. */
  take(b: Btn) {
    const p = this.pressed.has(b);
    this.pressed.delete(b);
    return p;
  }

  clearPressed() {
    this.pressed.clear();
  }

  /** Touch players get auto throttle so one thumb steers and the other fights. */
  throttle() {
    if (this.isDown('down')) return false;
    return this.lastTouch || this.isDown('up');
  }
}
