import { Sound } from './audio';
import { Game, WEAPONS } from './game';
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
const helpEl = $('help');
const pauseEl = $('pause');
const touchEl = $('touch');
const muteBtn = $<HTMLButtonElement>('mute');
const weaponBtn = $<HTMLButtonElement>('weaponBtn');

if (input.touch) document.body.classList.add('touch');

const store = {
  get(k: string, s: Storage | null = null) {
    try {
      return (s ?? localStorage).getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string, s: Storage | null = null) {
    try {
      (s ?? localStorage).setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};
const session = (() => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
})();

// Races per session: the Phase 1 gate metric.
let sessionRaces = Number(store.get('throttle.races', session) || 0);
let racesDone = Number(store.get('throttle.racesDone') || 0);

let muted = store.get('throttle.muted') === '1';
const applyMute = () => {
  sound.setMuted(muted);
  muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
  muteBtn.setAttribute('aria-pressed', String(muted));
};
const toggleMute = () => {
  muted = !muted;
  store.set('throttle.muted', muted ? '1' : '0');
  applyMute();
};
applyMute();
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMute();
});
input.onMute = toggleMute;

const show = (el: HTMLElement) => el.classList.remove('hidden');
const hide = (el: HTMLElement) => el.classList.add('hidden');

function showTouch() {
  if (input.lastTouch && (game.phase === 'race' || game.phase === 'countdown') && !paused) show(touchEl);
}

function startRace() {
  sound.init();
  applyMute();
  sessionRaces++;
  store.set('throttle.races', String(sessionRaces), session);
  [titleEl, resultsEl, helpEl, pauseEl].forEach(hide);
  paused = false;
  document.body.classList.add('racing');
  // Hints teach the controls in the first three races.
  game.tutorial = racesDone < 3;
  game.start();
  showTouch();
}

$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);
$('restartBtn').addEventListener('click', startRace);

// How to play: open from any screen, return to where you came from.
let helpReturn: HTMLElement = titleEl;
document.querySelectorAll<HTMLElement>('[data-open-help]').forEach((b) =>
  b.addEventListener('click', () => {
    helpReturn = [titleEl, pauseEl, resultsEl].find((el) => !el.classList.contains('hidden')) ?? titleEl;
    hide(helpReturn);
    helpEl.scrollTop = 0;
    show(helpEl);
    $('helpBack').focus({ preventScroll: true });
  }),
);
$('helpBack').addEventListener('click', () => {
  hide(helpEl);
  show(helpReturn);
});

// Pause.
let paused = false;
function setPaused(p: boolean) {
  if (game.phase !== 'race' && game.phase !== 'countdown') return;
  paused = p;
  input.releaseAll();
  if (p) {
    sound.engine(0, false);
    hide(touchEl);
    show(pauseEl);
    $('resumeBtn').focus({ preventScroll: true });
  } else {
    hide(pauseEl);
    hide(helpEl);
    showTouch();
    last = performance.now();
  }
}
$('pauseBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  setPaused(true);
});
$('resumeBtn').addEventListener('click', () => setPaused(false));
input.onPause = () => {
  if (!helpEl.classList.contains('hidden')) {
    hide(helpEl);
    show(helpReturn);
    return;
  }
  setPaused(!paused);
};

input.onConfirm = () => {
  if (!helpEl.classList.contains('hidden')) {
    $('helpBack').click();
    return;
  }
  if (paused) setPaused(false);
  else if (game.phase === 'title' || (game.phase === 'finished' && resultsShown)) startRace();
};
window.addEventListener('touchstart', showTouch, { passive: true });
window.addEventListener('keydown', (e) => {
  if (e.isTrusted) hide(touchEl);
});

let resultsShown = false;
let finishedAt = 0;

function showResults() {
  const r = game.results;
  if (!r) return;
  resultsShown = true;
  racesDone++;
  store.set('throttle.racesDone', String(racesDone));
  $('rRace').textContent = `RACE ${sessionRaces}`;
  $('rPlace').textContent = r.place === 1 ? '1st. You win.' : `${ordinal(r.place)} place`;
  $('rTime').textContent = formatTime(r.time);
  $('rKos').textContent = String(r.kos);
  $('rNear').textContent = String(r.nearMisses);
  $('rCombo').textContent = `x${r.topCombo}`;
  $('rBonus').textContent = `$${r.bonus.toLocaleString()}`;
  $('rScore').textContent = `$${r.score.toLocaleString()}`;
  $('rBest').textContent = r.newBest ? 'New best score' : `Best: $${r.best.toLocaleString()}`;
  hide(touchEl);
  document.body.classList.remove('racing');
  show(resultsEl);
  $<HTMLButtonElement>('againBtn').focus({ preventScroll: true });
}

window.addEventListener('resize', () => renderer.resize());

let hidden = false;
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  if (hidden) {
    sound.engine(0, false);
    if (game.phase === 'race') setPaused(true);
  }
  last = performance.now();
});

// Keep the weapon button in step with what the player holds.
let shownWeapon: string | null = null;
function syncWeaponButton() {
  const w = game.player.weapon;
  const key = w ? `${w}` : null;
  if (key === shownWeapon) return;
  shownWeapon = key;
  document.body.classList.toggle('has-weapon', !!w);
  if (w) weaponBtn.textContent = WEAPONS[w].label;
}

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fps = 60;
const debug = new URLSearchParams(location.search).has('debug');
if (debug) Object.assign(window, { __game: game, __renderer: renderer });

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!hidden && !paused) {
    const wasFinished = game.phase === 'finished';
    game.update(dt);
    if (game.phase === 'finished' && !wasFinished) {
      finishedAt = now;
      resultsShown = false;
    }
    if (game.phase === 'finished' && !resultsShown && now - finishedAt > 1600) showResults();
    syncWeaponButton();
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
