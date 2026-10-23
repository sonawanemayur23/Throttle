// Offline install for the hosted build. Skipped inside frames (like the
// playtest artifact) and on plain http, where service workers cannot run.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  if (window.top !== window.self) return;
  if (import.meta.env.MODE === 'single') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
