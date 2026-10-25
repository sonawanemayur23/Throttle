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
