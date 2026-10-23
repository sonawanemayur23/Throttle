import { createRoot } from 'react-dom/client';
import { GameHost } from './app/host';
import { raceSetup } from './app/setup';
import { TRACKS } from './content/tracks';
import { loadSave } from './save/save';
import { App } from './ui/App';
import { registerServiceWorker } from './app/pwa';
import './ui/style.css';
import './ui/controls.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const host = new GameHost(canvas, raceSetup(loadSave(), 1, TRACKS[0].id));

if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __host: host, __game: host.game, __tracks: TRACKS });

createRoot(document.getElementById('ui') as HTMLElement).render(<App host={host} />);
registerServiceWorker();
