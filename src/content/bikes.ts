// Bikes and upgrades. All names are original. Tune numbers here, not in the engine.

export type UpgradeKind = 'engine' | 'tyres' | 'armour';
export const UPGRADE_KINDS: UpgradeKind[] = ['engine', 'tyres', 'armour'];
export const MAX_UPGRADE = 3;

export interface BikeDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
  /** Multipliers on the base bike. 1 = the starter bike's stock value. */
  speed: number;
  accel: number;
  handling: number;
  armour: number;
  color: string;
  /** Price of the first upgrade level. Later levels cost more. */
  upgradeBase: number;
}

export const BIKES: BikeDef[] = [
  { id: 'sparrow', name: 'Sparrow 250', blurb: 'Light and forgiving. Every rider starts here.', price: 0, speed: 0.92, accel: 0.95, handling: 1.05, armour: 1, color: '#16181d', upgradeBase: 1500 },
  { id: 'kestrel', name: 'Kestrel 600', blurb: 'Quicker off the line and steady in a fight.', price: 18000, speed: 1, accel: 1.05, handling: 1.05, armour: 1.05, color: '#1e5fbf', upgradeBase: 3000 },
  { id: 'bison', name: 'Bison 900', blurb: 'Heavy cruiser. Slow to turn, shrugs off hits.', price: 32000, speed: 1.03, accel: 0.95, handling: 0.88, armour: 1.45, color: '#7a3b1d', upgradeBase: 4500 },
  { id: 'shrike', name: 'Shrike 1000', blurb: 'Sharp sport bike. Fast, nimble, fragile.', price: 55000, speed: 1.1, accel: 1.15, handling: 1.12, armour: 0.9, color: '#c71f2d', upgradeBase: 7000 },
  { id: 'nightjar', name: 'Nightjar R', blurb: 'The top of the line. Fast everywhere.', price: 95000, speed: 1.16, accel: 1.2, handling: 1.12, armour: 1.15, color: '#5b2a9e', upgradeBase: 11000 },
];

export const UPGRADE_INFO: Record<UpgradeKind, { label: string; effect: string }> = {
  engine: { label: 'Engine', effect: '+3% top speed and +5% acceleration per level' },
  tyres: { label: 'Tyres', effect: '+8% grip per level, less slowdown off the road' },
  armour: { label: 'Armour', effect: '+15% health and 8% less damage per level' },
};

const LEVEL_COST = [1, 2.2, 4];

export function upgradeCost(bike: BikeDef, level: number) {
  // `level` is the level being bought, 1..MAX_UPGRADE.
  return Math.round((bike.upgradeBase * LEVEL_COST[level - 1]) / 100) * 100;
}

export function bikeById(id: string) {
  return BIKES.find((b) => b.id === id) ?? BIKES[0];
}

/** Final numbers the engine uses, after upgrades. */
export interface BikeStats {
  topSpeed: number;
  accel: number;
  handling: number;
  hp: number;
  damageTaken: number;
  offroadGrip: number;
  color: string;
}

export function bikeStats(bike: BikeDef, up: Record<UpgradeKind, number>): BikeStats {
  return {
    topSpeed: bike.speed * (1 + 0.03 * up.engine),
    accel: bike.accel * (1 + 0.05 * up.engine),
    handling: bike.handling * (1 + 0.08 * up.tyres),
    hp: 100 * bike.armour * (1 + 0.15 * up.armour),
    damageTaken: 1 - 0.08 * up.armour,
    offroadGrip: 1 + 0.15 * up.tyres,
    color: bike.color,
  };
}

export const STOCK: Record<UpgradeKind, number> = { engine: 0, tyres: 0, armour: 0 };
