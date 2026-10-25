// Play stats. Umami only, and only from the hosted build. The engine never
// imports this. See decision D14.

export const PLAYER_KEY = 'throttle.player';
export const UMAMI_WEBSITE_ID = 'a01ee3b2-350b-4f26-9af5-19ba2c6e37b1';
export const UMAMI_SCRIPT = 'https://cloud.umami.is/script.js';
const DEFAULT_HOST = 'https://gateway.umami.is';

export type AnalyticsName = 'race_start' | 'race_end' | 'purchase' | 'level_unlock' | 'app_open' | 'install_card' | 'challenge_sent' | 'challenge_open' | 'challenge_result' | 'daily_end';

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

/** True only for a production build that is not a Vercel preview or dev deploy. */
export function hostedAnalytics(mode: string, vercelEnv: string | undefined): boolean {
  if (mode !== 'production') return false;
  if (vercelEnv === 'preview' || vercelEnv === 'development') return false;
  return true;
}

/**
 * The tracker tag, added to the production HTML only. The script is not fetched
 * when the page is opened on localhost, so a local preview of dist/ stays quiet.
 */
export function umamiHeadScript(): string {
  return `<script>
(function () {
  var host = location.hostname.replace(/^\\[|\\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = '${UMAMI_SCRIPT}';
  s.setAttribute('data-website-id', '${UMAMI_WEBSITE_ID}');
  document.head.appendChild(s);
})();
</script>`;
}

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
    mode: import.meta.env.VITE_ANALYTICS === '1' ? 'production' : 'development',
    websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID || UMAMI_WEBSITE_ID,
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
