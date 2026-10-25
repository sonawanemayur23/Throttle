// The four highways. Each one is generated from a seed plus a few shape knobs,
// so the same track comes out the same on every device.

export type SceneryKind = 'palm' | 'palm2' | 'rock' | 'sign' | 'bush' | 'tower' | 'cactus' | 'cactus2' | 'windmill' | 'pine' | 'deadpine' | 'logs' | 'cliff' | 'building' | 'shop' | 'lamp' | 'trafficlight' | 'busstop';

export interface Palette {
  /** Top to horizon, sampled from the Prompt 6 sky gradients (stops 0, 0.55, 1) at 0, 0.45, 0.8 and 1. */
  sky: [string, string, string, string];
  sun: 'sun' | 'noon' | 'pale' | 'moon';
  ridges: [string, string, string]; // far to near
  skyline?: boolean; // draw city blocks instead of hills
  fog: string;
  ground: [string, string];
  road: [string, string];
  rumble: [string, string];
  lane: string;
  night?: boolean;
}

export interface TrackDef {
  id: string;
  name: string;
  blurb: string;
  seed: number;
  /** Target length in road segments. About 3500 is a 75 second race. */
  segments: number;
  /** Shape knobs: 1 is the coast road. */
  curves: number;
  hills: number;
  traffic: number;
  palette: Palette;
  /** Roadside scenery: kind, weight, nearest and furthest offset from the road center. */
  scenery: Array<[SceneryKind, number, number, number]>;
}

export const TRACKS: TrackDef[] = [
  {
    id: 'coast',
    name: 'Sunset Coast',
    blurb: 'Wide sweeping bends along the shore. Good for learning.',
    seed: 7,
    segments: 3500,
    curves: 1,
    hills: 1,
    traffic: 1,
    palette: {
      sky: ['#2b2257', '#9b486a', '#d57065', '#f08a5d'],
      sun: 'sun',
      ridges: ['#7d4a6e', '#a35a68', '#c8735f'],
      fog: '#f2b48a',
      ground: ['#c9b27c', '#bea672'],
      road: ['#5c5a5e', '#545256'],
      rumble: ['#f4f4f4', '#d23b2f'],
      lane: '#eeeeee',
    },
    scenery: [
      ['palm', 30, 1.35, 2.9],
      ['palm2', 10, 1.5, 3.2],
      ['bush', 15, 1.25, 3.2],
      ['rock', 12, 1.45, 3.6],
      ['tower', 3, 1.7, 2.4],
      ['sign', 4, 2.1, 2.3],
    ],
  },
  {
    id: 'desert',
    name: 'Red Mesa',
    blurb: 'Long straights and big hills. Top speed wins here.',
    seed: 23,
    segments: 3700,
    curves: 0.7,
    hills: 1.5,
    traffic: 0.8,
    palette: {
      sky: ['#2d5d9f', '#7d9bbd', '#c5c2b1', '#f0d6a2'],
      sun: 'noon',
      ridges: ['#a8643f', '#c27a4c', '#d99662'],
      fog: '#f2dcae',
      ground: ['#e2c08a', '#d8b47c'],
      road: ['#6a6566', '#625d5e'],
      rumble: ['#f4f4f4', '#3a3a3a'],
      lane: '#f4f1e8',
    },
    scenery: [
      ['cactus', 28, 1.3, 3.4],
      ['cactus2', 16, 1.25, 3],
      ['rock', 22, 1.5, 4],
      ['bush', 12, 1.25, 3],
      ['windmill', 3, 1.8, 3],
      ['sign', 5, 1.6, 1.75],
    ],
  },
  {
    id: 'mountain',
    name: 'Pine Pass',
    blurb: 'Tight switchbacks through the forest. Brake before the bends.',
    seed: 41,
    segments: 3300,
    curves: 1.45,
    hills: 1.25,
    traffic: 0.9,
    palette: {
      sky: ['#1e2f4a', '#6b8495', '#afc1c6', '#d7e3df'],
      sun: 'pale',
      ridges: ['#2f4858', '#3f6070', '#55808a'],
      fog: '#c9d8d6',
      ground: ['#4f7a43', '#47703c'],
      road: ['#55585c', '#4e5155'],
      rumble: ['#f4f4f4', '#d8a72a'],
      lane: '#f2f2f2',
    },
    scenery: [
      ['pine', 56, 1.3, 3.2],
      ['deadpine', 6, 1.35, 3],
      ['rock', 14, 1.45, 2.8],
      ['logs', 4, 1.5, 2],
      ['cliff', 4, 2.2, 3.2],
      ['sign', 3, 1.4, 1.45],
    ],
  },
  {
    id: 'city',
    name: 'Neon Night',
    blurb: 'Downtown after dark. Heavy traffic and nowhere to hide.',
    seed: 77,
    segments: 3500,
    curves: 0.9,
    hills: 0.6,
    traffic: 1.5,
    palette: {
      sky: ['#05060f', '#1e1532', '#3a244d', '#4b2d5c'],
      sun: 'moon',
      ridges: ['#0d0f1f', '#151a33', '#1f2445'],
      skyline: true,
      fog: '#2a2346',
      ground: ['#3a3a44', '#34343e'],
      road: ['#2b2c33', '#27282f'],
      rumble: ['#d9d9d9', '#e8452c'],
      lane: '#f2d36b',
      night: true,
    },
    scenery: [
      ['building', 42, 1.8, 2.8],
      ['shop', 14, 1.5, 1.65],
      ['lamp', 22, 1.15, 1.15],
      ['trafficlight', 4, 1.2, 1.2],
      ['busstop', 6, 1.35, 1.4],
    ],
  },
];

export function trackById(id: string) {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
