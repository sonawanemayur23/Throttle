import { createRoot } from 'react-dom/client';
import { GameHost } from './app/host';
import { raceSetup } from './app/setup';
import { TRACKS } from './content/tracks';
import { loadSave } from './save/save';
import { App } from './ui/App';
import { registerServiceWorker } from './app/pwa';
import { svgArt } from './engine/svgart';
import { encodeGhost } from './engine/ghost';
import './ui/style.css';
import './ui/controls.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const host = new GameHost(canvas, raceSetup(loadSave(), 1, TRACKS[0].id));

if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __host: host, __game: host.game, __tracks: TRACKS, __encodeGhost: encodeGhost });

createRoot(document.getElementById('ui') as HTMLElement).render(<App host={host} />);
registerServiceWorker();

// Loading screen: fade out once the race art has decoded, with a short floor so
// the logo is seen, and a ceiling so a slow image never holds the game back.
const boot = document.getElementById('boot');
if (boot) {
  const started = performance.now();
  const floor = new Promise((r) => setTimeout(r, 1400));
  const ready = Promise.race([svgArt.loaded(), new Promise((r) => setTimeout(r, 6000))]);
  Promise.all([floor, ready]).then(() => {
    boot.classList.add('done');
    setTimeout(() => {
      boot.remove();
      clearInterval((window as unknown as { __bootTips?: number }).__bootTips);
    }, 500);
    if (new URLSearchParams(location.search).has('debug')) console.log(`boot ${Math.round(performance.now() - started)} ms`);
  });
}
