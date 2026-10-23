import { describe, expect, it } from 'vitest';
import { BIKES, upgradeCost } from '../content/bikes';
import { LEVELS } from '../content/career';
import { TRACKS } from '../content/tracks';
import { buyBike, buyUpgrade, exportCode, importCode, migrate, newSave, recordRace, unlockedLevel } from '../save/save';

const race = (level: number, trackId: string, place: number, extra = {}) => ({
  level,
  trackId,
  place,
  earnings: 1000,
  kos: 2,
  busted: false,
  fine: 0,
  score: 1000,
  ...extra,
});

describe('save', () => {
  it('starts with the starter bike and level 1', () => {
    const s = newSave();
    expect(Object.keys(s.bikes)).toEqual([BIKES[0].id]);
    expect(unlockedLevel(s)).toBe(1);
  });

  it('repairs broken or hostile data', () => {
    const s = migrate({ cash: -50, selectedBike: 'nope', bikes: { sparrow: { upgrades: { engine: 99, tyres: 'x' } } } });
    expect(s.cash).toBe(0);
    expect(s.selectedBike).toBe(BIKES[0].id);
    expect(s.bikes.sparrow.upgrades).toEqual({ engine: 3, tyres: 0, armour: 0 });
    expect(migrate(null)).toEqual(newSave());
    expect(migrate('garbage')).toEqual(newSave());
  });

  it('unlocks the next level only after top 3 on every track', () => {
    let s = newSave();
    for (const t of TRACKS.slice(0, 3)) s = recordRace(s, race(1, t.id, 2)).save;
    expect(unlockedLevel(s)).toBe(1);
    const r = recordRace(s, race(1, TRACKS[3].id, 4));
    expect(r.unlocked).toBeNull();
    const r2 = recordRace(r.save, race(1, TRACKS[3].id, 3));
    expect(r2.unlocked).toBe(2);
    expect(unlockedLevel(r2.save)).toBe(2);
  });

  it('never unlocks past the last level', () => {
    let s = newSave();
    for (const L of LEVELS) for (const t of TRACKS) s = recordRace(s, race(L.level, t.id, 1)).save;
    expect(unlockedLevel(s)).toBe(LEVELS.length);
  });

  it('keeps the best place and does not count busted races', () => {
    let s = recordRace(newSave(), race(1, 'coast', 2)).save;
    s = recordRace(s, race(1, 'coast', 5)).save;
    expect(s.career[1].coast).toBe(2);
    s = recordRace(s, race(1, 'desert', 1, { busted: true, fine: 400, earnings: 300 })).save;
    expect(s.career[1].desert).toBeUndefined();
    expect(s.stats.busted).toBe(1);
  });

  it('pays earnings and takes fines without going below zero', () => {
    const s = recordRace(newSave(), race(2, 'coast', 7, { busted: true, earnings: 100, fine: 5000 })).save;
    expect(s.cash).toBe(0);
  });

  it('buys bikes and upgrades only with enough cash', () => {
    let s = { ...newSave(), cash: 1000 };
    expect(buyBike(s, 'kestrel').ok).toBe(false);
    s = { ...s, cash: BIKES[1].price + 100 };
    const b = buyBike(s, 'kestrel');
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.save.cash).toBe(100);
    expect(b.save.selectedBike).toBe('kestrel');
    const cost = upgradeCost(BIKES[0], 1);
    const u = buyUpgrade({ ...b.save, cash: cost }, 'sparrow', 'engine');
    expect(u.ok && u.save.bikes.sparrow.upgrades.engine).toBe(1);
    expect(u.ok && u.save.cash).toBe(0);
  });

  it('round trips a save code', () => {
    const s = { ...newSave(), cash: 4321 };
    expect(importCode(exportCode(s))?.cash).toBe(4321);
    expect(importCode('not a code')).toBeNull();
  });
});
