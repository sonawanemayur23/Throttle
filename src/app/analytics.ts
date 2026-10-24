// Play stats. Umami only, and only from the hosted build. The engine never
// imports this. See decision D14.

export const PLAYER_KEY = 'throttle.player';
const DEFAULT_HOST = 'https://gateway.umami.is';

export type AnalyticsName = 'race_start' | 'race_end' | 'purchase' | 'level_unlock';

export interface AnalyticsEnv {
  mode: string;
  websiteId: string;
  endpointHost: string;
  hostname: string;
}

export interface PageInfo {
  hostname: string;
  language: string;
  referrer: string;
  screen: string;
  title: string;
  url: string;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean }) => Promise<unknown>;

const LOCAL = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/** Hosted production only. Dev, the one-file playtest build, and localhost stay quiet. */
export function analyticsAllowed(env: AnalyticsEnv): boolean {
  if (env.mode !== 'production') return false;
  if (!env.websiteId.trim()) return false;
  const host = env.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return !LOCAL.has(host);
}

/** Stable anonymous id for this browser. Not part of the save, so a reset keeps the same player. */
export function playerId(store: Store): string {
  const current = store.getItem(PLAYER_KEY);
  if (current && /^[A-Za-z0-9-]{8,50}$/.test(current)) return current;
  const next = crypto.randomUUID();
  store.setItem(PLAYER_KEY, next);
  return next;
}

export function analyticsEndpoint(env: AnalyticsEnv): string {
  const host = (env.endpointHost.trim() || DEFAULT_HOST).replace(/\/$/, '');
  return `${host}/api/send`;
}

export function buildPayload(env: AnalyticsEnv, id: string, page: PageInfo, name: AnalyticsName, data: Record<string, string | number>) {
  return {
    type: 'event' as const,
    payload: {
      hostname: page.hostname,
      language: page.language,
      referrer: page.referrer,
      screen: page.screen,
      title: page.title,
      url: page.url,
      website: env.websiteId.trim(),
      id,
      name,
      data,
    },
  };
}

/** Returns true when a request was started. Failures are ignored. */
export function sendAnalytics(
  env: AnalyticsEnv,
  page: PageInfo,
  store: Store,
  name: AnalyticsName,
  data: Record<string, string | number>,
  fetchImpl: FetchLike,
): boolean {
  if (!analyticsAllowed(env)) return false;
  const body = buildPayload(env, playerId(store), page, name, data);
  void fetchImpl(analyticsEndpoint(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
  return true;
}

function liveEnv(): AnalyticsEnv {
  return {
    mode: import.meta.env.MODE,
    websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID ?? '',
    endpointHost: import.meta.env.VITE_UMAMI_HOST ?? DEFAULT_HOST,
    hostname: location.hostname,
  };
}

function livePage(): PageInfo {
  return {
    hostname: location.hostname,
    language: navigator.language,
    referrer: document.referrer,
    screen: `${screen.width}x${screen.height}`,
    title: document.title,
    url: `${location.pathname}${location.search}`,
  };
}

export function track(name: AnalyticsName, data: Record<string, string | number>) {
  try {
    sendAnalytics(liveEnv(), livePage(), localStorage, name, data, (url, init) => fetch(url, init));
  } catch {
    /* private mode, or the browser blocked the request */
  }
}
