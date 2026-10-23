export type Btn = 'left' | 'right' | 'up' | 'down' | 'punch' | 'kick';

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
};

export class Input {
  private held = new Set<Btn>();
  private touchHeld = new Set<Btn>();
  private pressed = new Set<Btn>();
  readonly touch: boolean;
  /** Last input came from the on-screen buttons. */
  lastTouch: boolean;
  onConfirm: (() => void) | null = null;
  onMute: (() => void) | null = null;

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
    window.addEventListener('touchstart', () => {
      this.lastTouch = true;
      document.body.classList.add('touch');
    }, { passive: true });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchHeld.clear();
    });

    document.querySelectorAll<HTMLElement>('[data-btn]').forEach((el) => {
      const b = el.dataset.btn as Btn;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        this.lastTouch = true;
        el.setPointerCapture?.(e.pointerId);
        if (!this.touchHeld.has(b)) this.pressed.add(b);
        this.touchHeld.add(b);
        el.classList.add('on');
        navigator.vibrate?.(8);
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        this.touchHeld.delete(b);
        el.classList.remove('on');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  isDown(b: Btn) {
    return this.held.has(b) || this.touchHeld.has(b);
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
