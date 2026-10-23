// Career: 5 levels. Finish in the top 3 on all four tracks to unlock the next level.

export interface LevelDef {
  level: number;
  name: string;
  /** Rival top speed as a share of base top speed. */
  rivalSkill: [number, number];
  rivalAggression: [number, number];
  /** Riders who start with a weapon. */
  armed: number;
  /** Police chase from this level up. */
  cops: boolean;
  /** Fine when the police catch you. */
  fine: number;
  /** Prize for 1st to 7th place. */
  prize: number[];
  /** Traffic multiplier on top of the track's own. */
  traffic: number;
}

const base = [2000, 1300, 900, 600, 400, 250, 150];
const scale = (k: number) => base.map((p) => Math.round((p * k) / 50) * 50);

export const LEVELS: LevelDef[] = [
  { level: 1, name: 'Rookie', rivalSkill: [0.84, 0.92], rivalAggression: [0.35, 0.7], armed: 1, cops: false, fine: 0, prize: scale(1), traffic: 1 },
  { level: 2, name: 'Street', rivalSkill: [0.88, 0.96], rivalAggression: [0.45, 0.8], armed: 2, cops: true, fine: 1500, prize: scale(1.6), traffic: 1.05 },
  { level: 3, name: 'Pro', rivalSkill: [0.92, 1.0], rivalAggression: [0.5, 0.85], armed: 2, cops: true, fine: 3000, prize: scale(2.4), traffic: 1.1 },
  { level: 4, name: 'Outlaw', rivalSkill: [0.96, 1.05], rivalAggression: [0.6, 0.9], armed: 3, cops: true, fine: 5000, prize: scale(3.4), traffic: 1.15 },
  { level: 5, name: 'Legend', rivalSkill: [1.0, 1.1], rivalAggression: [0.7, 0.95], armed: 4, cops: true, fine: 8000, prize: scale(4.8), traffic: 1.2 },
];

export const QUALIFY_PLACE = 3;

export function levelDef(n: number) {
  return LEVELS[Math.max(1, Math.min(LEVELS.length, n)) - 1];
}
