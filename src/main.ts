import { Sound } from './audio';
import { Game } from './game';
import { Input } from './input';
import { formatTime, Renderer } from './render';
import { ordinal } from './util';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game');
const sound = new Sound();
const input = new Input();
const game = new Game(sound, input);
const renderer = new Renderer(canvas);

const titleEl = $('title');
const resultsEl = $('results');
const touchEl = $('touch');
const muteBtn = $<HTMLButtonElement>('mute');

if (input.touch) document.body.classList.add('touch');

// Races per session: the Phase 1 gate metric.
let sessionRaces = 0;
try {
  sessionRaces = Number(sessionStorage.getItem('throttle.races') || 0);
} catch {
  /* storage blocked */
}

let muted = false;
try {
  muted = localStorage.getItem('throttle.muted') === '1';
} catch {
  /* storage blocked */
}
const applyMute = () => {
  sound.setMuted(muted);
  muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
};
const toggleMute = () => {
  muted = !muted;
  try {
    localStorage.setItem('throttle.muted', muted ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  applyMute();
};
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMute();
});
input.onMute = toggleMute;

function startRace() {
  if (game.phase === 'countdown' || game.phase === 'race') return;
  sound.init();
  applyMute();
  sessionRaces++;
  try {
    sessionStorage.setItem('throttle.races', String(sessionRaces));
  } catch {
    /* storage blocked */
  }
  titleEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  if (input.lastTouch || input.touch) touchEl.classList.remove('hidden');
  document.body.classList.add('racing');
  game.start();
}

$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);
input.onConfirm = () => {
  if (game.phase === 'title' || (game.phase === 'finished' && resultsShown)) startRace();
};
window.addEventListener('touchstart', () => {
  if (game.phase === 'race' || game.phase === 'countdown') touchEl.classList.remove('hidden');
}, { passive: true });
window.addEventListener('keydown', (e) => {
  if (e.isTrusted) touchEl.classList.add('hidden');
});

let resultsShown = false;
let finishedAt = 0;

function showResults() {
  const r = game.results;
  if (!r) return;
  resultsShown = true;
  $('rRace').textContent = `RACE ${sessionRaces}`;
  $('rPlace').textContent = r.place === 1 ? '1st. You win.' : `${ordinal(r.place)} place`;
  $('rTime').textContent = formatTime(r.time);
  $('rKos').textContent = String(r.kos);
  $('rNear').textContent = String(r.nearMisses);
  $('rCombo').textContent = `x${r.topCombo}`;
  $('rBonus').textContent = `$${r.bonus.toLocaleString()}`;
  $('rScore').textContent = `$${r.score.toLocaleString()}`;
  $('rBest').textContent = r.newBest ? 'New best score' : `Best: $${r.best.toLocaleString()}`;
  touchEl.classList.add('hidden');
  document.body.classList.remove('racing');
  resultsEl.classList.remove('hidden');
  $<HTMLButtonElement>('againBtn').focus();
}

window.addEventListener('resize', () => renderer.resize());

let paused = false;
document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  if (paused) sound.engine(0, false);
  last = performance.now();
});

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fps = 60;
const debug = new URLSearchParams(location.search).has('debug');
if (debug) Object.assign(window, { __game: game, __renderer: renderer });

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    const wasFinished = game.phase === 'finished';
    game.update(dt);
    if (game.phase === 'finished' && !wasFinished) {
      finishedAt = now;
      resultsShown = false;
    }
    if (game.phase === 'finished' && !resultsShown && now - finishedAt > 1600) showResults();
    renderer.render(game, dt);
    if (debug) {
      fpsAcc += dt;
      fpsN++;
      if (fpsAcc > 0.5) {
        fps = Math.round(fpsN / fpsAcc);
        fpsAcc = 0;
        fpsN = 0;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f0';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${fps} fps  ${canvas.width}x${canvas.height}`, 8, canvas.height - 8);
      }
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
