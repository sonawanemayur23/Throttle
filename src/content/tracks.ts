// The four highways. Each one is generated from a seed plus a few shape knobs,
// so the same track comes out the same on every device.

export type SceneryKind = 'palm' | 'rock' | 'sign' | 'bush' | 'cactus' | 'pine' | 'building' | 'lamp';

export interface Palette {
  sky: [string, string, string, string]; // top to horizon
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
      sky: ['#2b2257', '#b4506e', '#f08a5d', '#f6c08f'],
      sun: 'sun',
      ridges: ['#7d4a6e', '#a35a68', '#c8735f'],
      fog: '#f2b48a',
      ground: ['#c9b27c', '#bea672'],
      road: ['#5c5a5e', '#545256'],
      rumble: ['#f4f4f4', '#d23b2f'],
      lane: '#eeeeee',
    },
    scenery: [
      ['palm', 45, 1.3, 2.9],
      ['bush', 17, 1.2, 3.2],
      ['rock', 13, 1.4, 3.6],
      ['sign', 5, 1.35, 1.35],
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
      sky: ['#2d5d9f', '#6fa3d1', '#f0d6a2', '#f7e3b8'],
      sun: 'noon',
      ridges: ['#a8643f', '#c27a4c', '#d99662'],
      fog: '#f2dcae',
      ground: ['#e2c08a', '#d8b47c'],
      road: ['#6a6566', '#625d5e'],
      rumble: ['#f4f4f4', '#3a3a3a'],
      lane: '#f4f1e8',
    },
    scenery: [
      ['cactus', 40, 1.3, 3.4],
      ['rock', 30, 1.4, 4],
      ['bush', 10, 1.3, 3],
      ['sign', 6, 1.35, 1.35],
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
      sky: ['#1e2f4a', '#4f6f8f', '#a9c2c9', '#d7e3df'],
      sun: 'pale',
      ridges: ['#2f4858', '#3f6070', '#55808a'],
      fog: '#c9d8d6',
      ground: ['#4f7a43', '#47703c'],
      road: ['#55585c', '#4e5155'],
      rumble: ['#f4f4f4', '#d8a72a'],
      lane: '#f2f2f2',
    },
    scenery: [
      ['pine', 60, 1.3, 3.2],
      ['rock', 20, 1.3, 2.8],
      ['bush', 10, 1.2, 2.4],
      ['sign', 3, 1.35, 1.35],
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
      sky: ['#05060f', '#141a3a', '#2b2550', '#4b2d5c'],
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
      ['building', 55, 1.6, 2.6],
      ['lamp', 25, 1.15, 1.15],
      ['sign', 8, 1.35, 1.35],
    ],
  },
];

export function trackById(id: string) {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
