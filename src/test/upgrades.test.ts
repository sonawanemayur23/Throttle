import { describe, expect, it } from 'vitest';
import { BIKES, MAX_UPGRADE, STOCK, UPGRADE_INFO, UPGRADE_KINDS, upgradeGains } from '../content/bikes';

describe('upgrade feedback', () => {
  it('every part has a name for each level', () => {
    for (const k of UPGRADE_KINDS) expect(UPGRADE_INFO[k].parts).toHaveLength(MAX_UPGRADE + 1);
  });

  it('the next level always moves each number the right way', () => {
    for (const b of BIKES)
      for (const k of UPGRADE_KINDS)
        for (let lvl = 0; lvl < MAX_UPGRADE; lvl++) {
          const gains = upgradeGains(b, { ...STOCK, [k]: lvl }, k);
          expect(gains.length).toBe(2);
          for (const g of gains) {
            if (g.label === 'Damage taken') expect(g.to).toBeLessThan(g.from);
            else expect(g.to).toBeGreaterThan(g.from);
          }
        }
  });

  it('engine on the starter bike reads in km/h', () => {
    const [speed] = upgradeGains(BIKES[0], STOCK, 'engine');
    expect(speed.label).toBe('Top speed');
    expect(speed.unit).toBe(' km/h');
    expect(speed.to - speed.from).toBeGreaterThanOrEqual(5);
  });
});
