// Offline install for the hosted build. Skipped inside frames (like the
// playtest artifact) and on plain http, where service workers cannot run.
// Never in `npm run dev`: the worker caches files cache-first, including Vite's
// own client script, whose connection token changes on every dev server start.
// A stale copy made the dev server refuse the live-reload socket (error 400).
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    // Clear a worker left over from an earlier dev session, and its cache.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => void r.unregister()))
      .catch(() => undefined);
    if ('caches' in window) void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
    return;
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  if (window.top !== window.self) return;
  if (import.meta.env.MODE === 'single') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
