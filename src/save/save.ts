// Guest save. Lives in localStorage on this device. Versioned so later phases
// (accounts and cloud sync in Phase 3) can migrate it.

import { BIKES, MAX_UPGRADE, STOCK, upgradeCost, type UpgradeKind } from '../content/bikes';
import { LEVELS, QUALIFY_PLACE } from '../content/career';
import { TRACKS } from '../content/tracks';

export const SAVE_KEY = 'throttle.save';
export const SAVE_VERSION = 6;

export interface OwnedBike {
  upgrades: Record<UpgradeKind, number>;
}

/** The seven race actions a player can put on a key. */
export const RACE_ACTIONS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'weapon'] as const;
export type RaceAction = (typeof RACE_ACTIONS)[number];

/** Defaults match the keys the game has always used. Each action can have more than one. */
export const DEFAULT_KEYS: Record<RaceAction, string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  punch: ['KeyJ', 'KeyZ'],
  kick: ['KeyK', 'KeyX'],
  weapon: ['KeyL', 'KeyC'],
};

const RESERVED_KEYS = new Set(['Enter', 'Space', 'Escape', 'KeyP', 'KeyM']);

const ACTION_LABEL: Record<RaceAction, string> = {
  left: 'Steer left',
  right: 'Steer right',
  up: 'Throttle',
  down: 'Brake',
  punch: 'Punch',
  kick: 'Kick',
  weapon: 'Swing weapon',
};

export function actionLabel(action: RaceAction) {
  return ACTION_LABEL[action];
}

export function keyLabel(code: string) {
  const named: Record<string, string> = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Space: 'Space' };
  if (named[code]) return named[code];
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

function copyKeys(keys: Record<RaceAction, string[]>): Record<RaceAction, string[]> {
  return {
    left: [...keys.left],
    right: [...keys.right],
    up: [...keys.up],
    down: [...keys.down],
    punch: [...keys.punch],
    kick: [...keys.kick],
    weapon: [...keys.weapon],
  };
}

function normalizeKeys(raw: unknown): Record<RaceAction, string[]> {
  const out = copyKeys(DEFAULT_KEYS);
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Partial<Record<RaceAction, unknown>>;
  for (const action of RACE_ACTIONS) {
    const list = src[action];
    if (!Array.isArray(list)) continue;
    const codes = list.filter((code): code is string => typeof code === 'string' && code.length > 0 && code.length <= 32 && !RESERVED_KEYS.has(code));
    if (codes.length > 0) out[action] = codes;
  }
  return out;
}

/** Put one key on an action. Menus keys and a key already used by another action stay as they are. */
export function rebind(keys: Record<RaceAction, string[]>, action: RaceAction, code: string): { ok: true; keys: Record<RaceAction, string[]> } | { ok: false; reason: string } {
  if (!code || RESERVED_KEYS.has(code)) return { ok: false, reason: 'That key opens menus. Pick another.' };
  for (const other of RACE_ACTIONS) {
    if (other !== action && keys[other].includes(code)) return { ok: false, reason: `${ACTION_LABEL[other]} already uses that key. Pick another.` };
  }
  const next = copyKeys(keys);
  next[action] = [code];
  return { ok: true, keys: next };
}

export interface SaveData {
  version: number;
  cash: number;
  bikes: Record<string, OwnedBike>;
  selectedBike: string;
  /** Best place per level per track: career[level][trackId] = place. */
  career: Record<number, Record<string, number>>;
  bestScore: Record<string, number>;
  settings: {
    muted: boolean;
    hints: boolean;
    /** 0 is off, 1 is full. Separate from the sound mute. */
    music: number;
    /** No screen shake and no slow motion. */
    reduceMotion: boolean;
    vibration: boolean;
    /** Full screen on phones while playing (version 4). */
    gameMode: boolean;
    /** Graphics quality (version 5). 'auto' measures the device during races. */
    quality: 'auto' | 'high' | 'low';
    /** Auto quality found this device too slow and switched to low. */
    lowDetected: boolean;
    /** Rider name shown to friends on challenge links (version 6). Empty: "A friend". */
    name: string;
    keys: Record<RaceAction, string[]>;
  };
  stats: { races: number; wins: number; kos: number; busted: number };
}

export function newSave(): SaveData {
  return {
    version: SAVE_VERSION,
    cash: 0,
    bikes: { [BIKES[0].id]: { upgrades: { ...STOCK } } },
    selectedBike: BIKES[0].id,
    career: {},
    bestScore: {},
    settings: { muted: false, hints: true, music: 0.7, reduceMotion: false, vibration: true, gameMode: true, quality: 'auto', lowDetected: false, name: '', keys: copyKeys(DEFAULT_KEYS) },
    stats: { races: 0, wins: 0, kos: 0, busted: 0 },
  };
}

/** Bring any stored value up to the current shape. Unknown or broken data starts fresh. */
export function migrate(raw: unknown): SaveData {
  const fresh = newSave();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<SaveData>;
  const prev = (r.settings ?? {}) as { music?: unknown; reduceMotion?: unknown; vibration?: unknown; gameMode?: unknown; quality?: unknown; lowDetected?: unknown; name?: unknown; keys?: unknown };
  const out: SaveData = {
    ...fresh,
    cash: Number.isFinite(r.cash) ? Math.max(0, Math.floor(r.cash as number)) : 0,
    selectedBike: typeof r.selectedBike === 'string' ? r.selectedBike : fresh.selectedBike,
    career: typeof r.career === 'object' && r.career ? r.career : {},
    bestScore: typeof r.bestScore === 'object' && r.bestScore ? r.bestScore : {},
    settings: {
      ...fresh.settings,
      ...(r.settings ?? {}),
      music: musicLevel(prev.music),
      reduceMotion: prev.reduceMotion === true,
      vibration: prev.vibration !== false,
      gameMode: prev.gameMode !== false,
      quality: prev.quality === 'high' || prev.quality === 'low' ? prev.quality : 'auto',
      lowDetected: prev.lowDetected === true,
      name: cleanName(prev.name),
      keys: normalizeKeys(prev.keys),
    },
    stats: { ...fresh.stats, ...(r.stats ?? {}) },
    bikes: {},
  };
  for (const b of BIKES) {
    const owned = r.bikes?.[b.id];
    if (!owned && b.price > 0) continue;
    const up = { ...STOCK };
    for (const k of Object.keys(up) as UpgradeKind[]) {
      const v = owned?.upgrades?.[k];
      up[k] = Number.isInteger(v) ? Math.max(0, Math.min(MAX_UPGRADE, v as number)) : 0;
    }
    out.bikes[b.id] = { upgrades: up };
  }
  if (!out.bikes[out.selectedBike]) out.selectedBike = BIKES[0].id;
  return out;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
    // Carry over the Phase 1 best score and sound setting.
    const s = newSave();
    s.bestScore.coast = Number(localStorage.getItem('throttle.best') || 0);
    s.settings.muted = localStorage.getItem('throttle.muted') === '1';
    return s;
  } catch {
    return newSave();
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the game still works, progress lasts for this visit */
  }
}

/** Save code to move progress between devices until accounts arrive in Phase 3. */
export function exportCode(s: SaveData) {
  const json = JSON.stringify(s);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importCode(code: string): SaveData | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const data = JSON.parse(json);
    // Older codes still load. A newer code waits for this build to catch up.
    if (!data || typeof data.version !== 'number' || data.version < 1 || data.version > SAVE_VERSION) return null;
    return migrate(data);
  } catch {
    return null;
  }
}

// ---- Rules that read or change the save. Pure functions, easy to test. ----

export function unlockedLevel(s: SaveData) {
  let lvl = 1;
  for (const L of LEVELS) {
    const res = s.career[L.level] ?? {};
    const cleared = TRACKS.every((t) => (res[t.id] ?? 99) <= QUALIFY_PLACE);
    if (cleared && L.level < LEVELS.length) lvl = L.level + 1;
    else break;
  }
  return lvl;
}

export function levelCleared(s: SaveData, level: number) {
  const res = s.career[level] ?? {};
  return TRACKS.every((t) => (res[t.id] ?? 99) <= QUALIFY_PLACE);
}

export interface RaceRecord {
  level: number;
  trackId: string;
  place: number;
  earnings: number;
  kos: number;
  busted: boolean;
  fine: number;
  score: number;
  /** A challenge race: cash and stats count, career places do not. */
  challenge?: boolean;
}

/** A rider name for challenge links: trimmed, at most 16 characters. */
export function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
}

/** Apply a finished race. Returns the new save and whether a level unlocked. */
export function recordRace(s: SaveData, r: RaceRecord): { save: SaveData; unlocked: number | null } {
  const before = unlockedLevel(s);
  const next: SaveData = structuredCloneSafe(s);
  next.cash = Math.max(0, next.cash + r.earnings - r.fine);
  next.stats.races++;
  next.stats.kos += r.kos;
  if (r.busted) next.stats.busted++;
  if (!r.busted && !r.challenge) {
    if (r.place === 1) next.stats.wins++;
    const lv = (next.career[r.level] ??= {});
    lv[r.trackId] = Math.min(lv[r.trackId] ?? 99, r.place);
  }
  next.bestScore[r.trackId] = Math.max(next.bestScore[r.trackId] ?? 0, r.score);
  const after = unlockedLevel(next);
  return { save: next, unlocked: after > before ? after : null };
}

export type BuyResult = { ok: true; save: SaveData } | { ok: false; reason: string };

export function buyBike(s: SaveData, bikeId: string): BuyResult {
  const bike = BIKES.find((b) => b.id === bikeId);
  if (!bike) return { ok: false, reason: 'Unknown bike' };
  if (s.bikes[bikeId]) return { ok: false, reason: 'You already own this bike' };
  if (s.cash < bike.price) return { ok: false, reason: `You need $${(bike.price - s.cash).toLocaleString()} more` };
  const next = structuredCloneSafe(s);
  next.cash -= bike.price;
  next.bikes[bikeId] = { upgrades: { ...STOCK } };
  next.selectedBike = bikeId;
  return { ok: true, save: next };
}

export function buyUpgrade(s: SaveData, bikeId: string, kind: UpgradeKind): BuyResult {
  const bike = BIKES.find((b) => b.id === bikeId);
  const owned = s.bikes[bikeId];
  if (!bike || !owned) return { ok: false, reason: 'Buy the bike first' };
  const lvl = owned.upgrades[kind];
  if (lvl >= MAX_UPGRADE) return { ok: false, reason: 'Fully upgraded' };
  const cost = upgradeCost(bike, lvl + 1);
  if (s.cash < cost) return { ok: false, reason: `You need $${(cost - s.cash).toLocaleString()} more` };
  const next = structuredCloneSafe(s);
  next.cash -= cost;
  next.bikes[bikeId].upgrades[kind] = lvl + 1;
  return { ok: true, save: next };
}

function musicLevel(v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0.7;
  return Math.min(1, Math.max(0, v));
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
