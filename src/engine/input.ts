export type Btn = 'left' | 'right' | 'up' | 'down' | 'punch' | 'kick' | 'weapon';


/** True when a key press belongs to a text field, not the game. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLInputElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || el.isContentEditable === true) return true;
  if (tag !== 'input') return false;
  // Switches and sliders still let the game keys through; text boxes do not.
  return !['checkbox', 'radio', 'range', 'button', 'submit'].includes((el.type || 'text').toLowerCase());
}

export const DEFAULT_KEYMAP: Record<string, Btn> = {
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
  private padAxis = 0;
  private padHeld = new Set<Btn>();
  private padPrev = new Set<string>();
  private codeToBtn: Record<string, Btn> = { ...DEFAULT_KEYMAP };
  private onCapture: ((code: string) => void) | null = null;
  /** True when a gamepad is connected and has been used. */
  gamepad = false;
  readonly touch: boolean;
  /** Last input came from the screen, not the keyboard. */
  lastTouch: boolean;
  /** Phone button taps buzz when this is on. */
  vibration = true;
  onConfirm: (() => void) | null = null;
  onMute: (() => void) | null = null;
  onPause: (() => void) | null = null;

  constructor() {
    this.touch = window.matchMedia('(pointer: coarse)').matches;
    this.lastTouch = this.touch;

    window.addEventListener('keydown', (e) => {
      // Typing in a text field (the challenge name box) is not game input:
      // without this, A steered, Space started a race and M muted.
      if (isTyping(e.target)) return;
      if (e.isTrusted) {
        this.lastTouch = false;
        document.body.classList.remove('touch');
      }
      if (this.onCapture && !e.repeat) {
        e.preventDefault();
        const fn = this.onCapture;
        this.onCapture = null;
        fn(e.code);
        return;
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
      const b = this.codeToBtn[e.code];
      if (!b) return;
      e.preventDefault();
      if (!this.held.has(b)) this.pressed.add(b);
      this.held.add(b);
    });
    window.addEventListener('keyup', (e) => {
      if (isTyping(e.target)) return;
      const b = this.codeToBtn[e.code];
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
      // Read at press time: the punch zone swaps to 'weapon' while armed.
      let b = el.dataset.btn as Btn;
      const active = new Set<number>();
      const down = (e: PointerEvent) => {
        e.preventDefault();
        if (active.size === 0) b = el.dataset.btn as Btn;
        this.lastTouch = true;
        active.add(e.pointerId);
        if (!this.touchHeld.has(b)) this.pressed.add(b);
        this.touchHeld.add(b);
        el.classList.add('on');
        try {
          if (this.vibration) navigator.vibrate?.(8);
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

  /** Replace the race keys. Call this when the saved bindings change. */
  setBindings(keys: Record<Btn, string[]>) {
    const map: Record<string, Btn> = {};
    for (const action of Object.keys(keys) as Btn[]) {
      for (const code of keys[action]) map[code] = action;
    }
    this.codeToBtn = map;
  }

  /** The next key press is handed to Settings instead of driving the bike. */
  listenForKey(fn: (code: string) => void) {
    this.onCapture = fn;
  }

  cancelListen() {
    this.onCapture = null;
  }

  releaseAll() {
    this.held.clear();
    this.touchHeld.clear();
    this.touchAxis = 0;
    document.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
  }

  /**
   * Read the first gamepad. Call once per frame. Standard mapping:
   * left stick or d-pad steers, RT throttle, LT brake, X punch, A kick,
   * Y weapon, Start pause, A or Start confirms on menus.
   */
  poll() {
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads?.() ?? [];
    } catch {
      return;
    }
    const gp = pads.find((p) => p && p.connected);
    this.padHeld.clear();
    this.padAxis = 0;
    if (!gp) return;
    const btn = (i: number) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
    const stick = gp.axes[0] ?? 0;
    let ax = Math.abs(stick) > 0.18 ? stick : 0;
    if (btn(14)) ax = -1;
    if (btn(15)) ax = 1;
    this.padAxis = Math.max(-1, Math.min(1, ax));
    const map: Array<[number, Btn]> = [
      [7, 'up'],
      [6, 'down'],
      [2, 'punch'],
      [0, 'kick'],
      [1, 'kick'],
      [3, 'weapon'],
    ];
    const now = new Set<string>();
    for (const [i, b] of map) {
      if (!btn(i)) continue;
      now.add(`${i}`);
      this.padHeld.add(b);
      if (!this.padPrev.has(`${i}`)) this.pressed.add(b);
    }
    for (const i of [9, 0]) if (btn(i)) now.add(`m${i}`);
    if (now.has('m9') && !this.padPrev.has('m9')) this.onPause?.();
    if (now.has('m0') && !this.padPrev.has('m0')) this.onConfirm?.();
    if (now.size > 0 || ax !== 0) {
      this.gamepad = true;
      this.lastTouch = false;
    }
    this.padPrev = now;
  }

  isDown(b: Btn) {
    return this.held.has(b) || this.touchHeld.has(b) || this.padHeld.has(b);
  }

  /** Steering from -1 (full left) to 1 (full right). */
  axis() {
    if (this.touchAxis !== 0) return this.touchAxis;
    if (this.padAxis !== 0) return this.padAxis;
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
