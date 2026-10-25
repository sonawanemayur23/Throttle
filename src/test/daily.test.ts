import { describe, expect, it } from 'vitest';
import { dailyFor, dayBefore, untilReset } from '../content/daily';
import { TRACKS } from '../content/tracks';
import { liveStreak, migrate, newSave, recordDaily } from '../save/save';

describe('daily race', () => {
  it('is the same all day for everyone, and changes at 00:00 UTC', () => {
    const a = dailyFor(new Date('2026-10-26T00:00:01Z'));
    const b = dailyFor(new Date('2026-10-26T23:59:59Z'));
    expect(b).toMatchObject({ key: '2026-10-26', trackId: a.trackId, level: a.level });
    expect(a.resetsIn).toBeGreaterThan(86_000_000);
    expect(b.resetsIn).toBe(1000);
    expect(dailyFor(new Date('2026-10-27T00:00:00Z')).key).toBe('2026-10-27');
  });

  it('uses every track, levels 1 to 3, never the same track two days running', () => {
    const seen = new Set<string>();
    let prev = '';
    for (let i = 0; i < 120; i++) {
      const d = dailyFor(new Date(Date.UTC(2026, 9, 1 + i, 12)));
      seen.add(d.trackId);
      expect(d.level).toBeGreaterThanOrEqual(1);
      expect(d.level).toBeLessThanOrEqual(3);
      expect(d.bonus).toBe(500 * d.level);
      expect(d.trackId).not.toBe(prev);
      prev = d.trackId;
    }
    expect(seen.size).toBe(TRACKS.length);
  });

  it('formats the reset countdown', () => {
    expect(untilReset(5 * 3_600_000 + 12 * 60_000)).toBe('5h 12m');
    expect(untilReset(59_000)).toBe('0m');
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
  });

  it('pays the bonus once a day, keeps the best time and counts the streak', () => {
    let s = newSave();
    let r = recordDaily(s, '2026-10-26', '2026-10-25', 90, 1000);
    expect(r.paid).toBe(1000);
    expect(r.newBest).toBe(true);
    s = r.save;
    expect(s.cash).toBe(1000);
    r = recordDaily(s, '2026-10-26', '2026-10-25', 95, 1000);
    expect(r.paid).toBe(0);
    expect(r.newBest).toBe(false);
    s = r.save;
    expect(s.daily).toMatchObject({ best: 90, tries: 2 });
    expect(s.streak.days).toBe(1);
    // Next day continues the streak; a busted try does not count.
    s = recordDaily(s, '2026-10-27', '2026-10-26', null, 1000).save;
    expect(s.streak.days).toBe(1);
    s = recordDaily(s, '2026-10-27', '2026-10-26', 88, 1000).save;
    expect(s.streak.days).toBe(2);
    expect(s.daily).toMatchObject({ key: '2026-10-27', best: 88, tries: 2 });
    // Skipping a day restarts it.
    expect(liveStreak(s, '2026-10-29', '2026-10-28')).toBe(0);
    s = recordDaily(s, '2026-10-29', '2026-10-28', 99, 1000).save;
    expect(s.streak).toMatchObject({ days: 1, best: 2 });
  });

  it('old saves gain empty daily and streak data', () => {
    const s = migrate({ version: 6, cash: 5 });
    expect(s.daily).toEqual({ key: '', best: null, tries: 0, bonusPaid: false });
    expect(s.streak).toEqual({ last: '', days: 0, best: 0 });
    expect(migrate({ daily: { key: 'nope', best: -3, tries: 2.5 } }).daily).toEqual({ key: '', best: null, tries: 0, bonusPaid: false });
  });
});
