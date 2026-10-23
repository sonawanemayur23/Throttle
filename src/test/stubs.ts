// Stand-ins for sound and input so the simulation runs in Node tests.
import type { Sound } from '../engine/audio';
import type { Btn, Input } from '../engine/input';

export function silentSound(): Sound {
  const noop = () => undefined;
  return new Proxy({}, { get: () => noop }) as unknown as Sound;
}

/** Scriptable input: set `steer`, hold buttons, queue presses. */
export class FakeInput {
  steer = 0;
  held = new Set<Btn>(['up']);
  queue = new Set<Btn>();
  lastTouch = false;
  axis() {
    return this.steer;
  }
  isDown(b: Btn) {
    return this.held.has(b);
  }
  take(b: Btn) {
    const had = this.queue.has(b);
    this.queue.delete(b);
    return had;
  }
  clearPressed() {
    this.queue.clear();
  }
  throttle() {
    return !this.held.has('down');
  }
  press(b: Btn) {
    this.queue.add(b);
  }
  asInput() {
    return this as unknown as Input;
  }
}
