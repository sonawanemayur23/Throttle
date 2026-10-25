import { afterEach, describe, expect, it, vi } from 'vitest';
import { installCardDue, iosBrowser, markInstallCard, turnTipDue } from '../app/gameMode';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function device(ua: string, { standalone = false, portrait = true } = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal('navigator', { userAgent: ua, platform: 'iPhone', maxTouchPoints: 5 });
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('coarse') ? true : q.includes('portrait') ? portrait : q.includes('display-mode') ? standalone : false,
  }));
  vi.stubGlobal('document', {});
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
}

afterEach(() => vi.unstubAllGlobals());

describe('iPhone full screen help', () => {
  it('tells Safari and Chrome on iPhone apart', () => {
    device(SAFARI);
    expect(iosBrowser()).toBe('safari');
    device(CHROME);
    expect(iosBrowser()).toBe('chrome');
    device(ANDROID);
    expect(iosBrowser()).toBeNull();
  });

  it('shows the install card before the first race and once more after the third', () => {
    device(CHROME);
    expect(installCardDue(0)).toBe('first');
    markInstallCard('first');
    expect(installCardDue(1)).toBeNull();
    expect(installCardDue(3)).toBe('third');
    markInstallCard('third');
    expect(installCardDue(9)).toBeNull();
  });

  it('never shows it from the Home Screen or off iPhone', () => {
    device(SAFARI, { standalone: true });
    expect(installCardDue(0)).toBeNull();
    device(ANDROID);
    expect(installCardDue(0)).toBeNull();
  });

  it('turn-sideways tip: first two races, portrait only', () => {
    device(SAFARI);
    expect(turnTipDue()).toBe(true);
    expect(turnTipDue()).toBe(true);
    expect(turnTipDue()).toBe(false);
    device(SAFARI, { portrait: false });
    expect(turnTipDue()).toBe(false);
  });
});
