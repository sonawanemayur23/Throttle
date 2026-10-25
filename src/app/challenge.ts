// "Beat my time" challenge links (P3-02). The whole ghost travels in the link's
// hash (#c=...), so no server is needed and the data never reaches one: browsers
// do not send the hash part of a URL.

import { decodeGhost, encodeGhost, type Ghost } from '../engine/ghost';
import { trackById } from '../content/tracks';
import { formatTime } from '../ui/format';

/** The challenge in this page's link, if any. */
export function challengeFromUrl(): Ghost | null {
  try {
    const m = location.hash.match(/[#&]c=([A-Za-z0-9_-]+)/);
    return m ? decodeGhost(m[1]) : null;
  } catch {
    return null;
  }
}

/** Drop the challenge from the address bar, so a reload goes to the title. */
export function clearChallengeUrl() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* not allowed in this frame */
  }
}

export function challengeLink(g: Ghost) {
  return `${location.origin}${location.pathname}#c=${encodeGhost(g)}`;
}

/** Share a challenge: the phone's share sheet when there is one, else copy the link. */
export async function shareChallenge(g: Ghost): Promise<'shared' | 'copied' | 'failed' | 'cancelled'> {
  const url = challengeLink(g);
  const track = trackById(g.trackId).name;
  const text = `I rode ${track} in ${formatTime(g.time)} on Throttle Bike. Beat my time:`;
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  if (nav.share && (!nav.canShare || nav.canShare({ text, url }))) {
    try {
      await nav.share({ title: 'Beat my time on Throttle Bike', text, url });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
