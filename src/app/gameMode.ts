// Game mode: full screen while playing on a phone, so the browser's own bars
// do not cover the race. Uses the Fullscreen API, which needs a tap to start.
// iPhone Safari has no full screen for pages; there the way in is Add to Home
// Screen, which opens the game full screen from the manifest.

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = () => document as FsDoc;

/** True when this browser can make the page full screen. */
export function canFullscreen() {
  return !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
}

/** True when the game already runs without browser bars (full screen, or opened from the home screen). */
export function isImmersive() {
  if (doc().fullscreenElement || doc().webkitFullscreenElement) return true;
  try {
    return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** Phones and tablets: game mode only matters on touch screens. */
export function isTouchDevice() {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Go full screen. Call from a tap or click. Fails quietly when the browser says no. */
export function enterGameMode() {
  if (isImmersive() || !canFullscreen()) return;
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not allowed here */
  }
}

export function exitGameMode() {
  const d = doc();
  if (!(d.fullscreenElement || d.webkitFullscreenElement)) return;
  try {
    if (d.exitFullscreen) d.exitFullscreen().catch(() => undefined);
    else d.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
}

/** Which iPhone browser this is, for install steps. null when not iOS. */
export function iosBrowser(): 'safari' | 'chrome' | 'other' | null {
  if (!isIOS()) return null;
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return 'other';
  return 'safari';
}

/** True on an iPhone or iPad browser tab, where only Add to Home Screen gives full screen. */
export function needsHomeScreen() {
  return isIOS() && isTouchDevice() && !isImmersive();
}

// Per-device memory for the install card and the turn-sideways tip. Browser
// storage is fine here: losing it only shows a tip again.
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

/**
 * The install card shows twice at most: before the first race, and again
 * after the third. Returns which showing is due, or null.
 */
export function installCardDue(races: number): 'first' | 'third' | null {
  if (!needsHomeScreen()) return null;
  const seen = read('throttle.installCard');
  if (!seen) return races < 3 ? 'first' : 'third';
  if (seen === 'first' && races >= 3) return 'third';
  return null;
}
export const markInstallCard = (which: 'first' | 'third') => write('throttle.installCard', which);

/** Turn-sideways tip: first two races in a portrait iPhone browser tab. */
export function turnTipDue() {
  if (!needsHomeScreen()) return false;
  try {
    if (!matchMedia('(orientation: portrait)').matches) return false;
  } catch {
    return false;
  }
  const n = Number(read('throttle.turnTip') ?? '0');
  if (n >= 2) return false;
  write('throttle.turnTip', String(n + 1));
  return true;
}
