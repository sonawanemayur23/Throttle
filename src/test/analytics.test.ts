import { describe, expect, it, vi } from 'vitest';
import { PLAYER_KEY, analyticsAllowed, buildPayload, playerId, sendAnalytics, type AnalyticsEnv, type PageInfo } from '../app/analytics';

const page: PageInfo = {
  hostname: 'throttle.vercel.app',
  language: 'en-US',
  referrer: '',
  screen: '390x844',
  title: 'Throttle',
  url: '/',
};

const live: AnalyticsEnv = {
  mode: 'production',
  websiteId: '11111111-1111-4111-8111-111111111111',
  endpointHost: 'https://gateway.umami.is',
  hostname: 'throttle.vercel.app',
};

function store() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('analytics', () => {
  it('stays quiet in dev, the playtest file, localhost, and without a website id', () => {
    expect(analyticsAllowed(live)).toBe(true);
    expect(analyticsAllowed({ ...live, mode: 'development' })).toBe(false);
    expect(analyticsAllowed({ ...live, mode: 'single' })).toBe(false);
    expect(analyticsAllowed({ ...live, mode: 'test' })).toBe(false);
    expect(analyticsAllowed({ ...live, hostname: 'localhost' })).toBe(false);
    expect(analyticsAllowed({ ...live, hostname: '127.0.0.1' })).toBe(false);
    expect(analyticsAllowed({ ...live, websiteId: '  ' })).toBe(false);
  });

  it('keeps one anonymous id and replaces a broken one', () => {
    const mem = store();
    const first = playerId(mem);
    expect(playerId(mem)).toBe(first);
    expect(first.length).toBeLessThanOrEqual(50);
    mem.setItem(PLAYER_KEY, 'nope');
    expect(playerId(mem)).not.toBe('nope');
  });

  it('does not store an id or call the network when sending is off', () => {
    const mem = store();
    const fetchImpl = vi.fn(() => Promise.resolve());
    expect(sendAnalytics({ ...live, hostname: 'localhost' }, page, mem, 'race_start', { track: 'coast', level: 1, bike: 'sparrow' }, fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mem.data.size).toBe(0);
  });

  it('posts a race event with the anonymous id when the hosted build is allowed to', () => {
    const mem = store();
    const fetchImpl = vi.fn((url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean }) => {
      void url;
      void init;
      return Promise.resolve();
    });
    const data = { track: 'coast', level: 1, bike: 'sparrow' };
    expect(sendAnalytics(live, page, mem, 'race_start', data, fetchImpl)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://gateway.umami.is/api/send');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body) as { payload: { id: string; name: string } };
    expect(body).toEqual(buildPayload(live, mem.getItem(PLAYER_KEY)!, page, 'race_start', data));
    expect(body.payload.id).toMatch(/^[A-Za-z0-9-]{8,50}$/);
    expect(body.payload.name).toBe('race_start');
  });
});
