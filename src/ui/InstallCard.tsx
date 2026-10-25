// Full screen on iPhone: browsers there cannot make a page full screen, but a
// game added to the Home Screen opens without any browser bars. This card walks
// players through it, with steps for Safari and for Chrome.

import { iosBrowser } from '../app/gameMode';

/** The iOS share symbol: a square with an arrow up. */
const ShareIcon = () => (
  <svg className="share-ico" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H6v10h12V10h-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function InstallCard({ onClose }: { onClose: () => void }) {
  const browser = iosBrowser();
  return (
    <div className={`install ${browser ?? 'other'}`} role="dialog" aria-modal="true" aria-labelledby="installTitle">
      <div className="install-card">
        <div className="eyebrow">Full screen, like a real game</div>
        <h2 id="installTitle" className="display">
          Add Throttle to your Home Screen
        </h2>
        <p className="muted">On iPhone the browser bars stay on screen. From the Home Screen the game opens full screen, with no bars.</p>
        {browser === 'other' ? (
          <ol>
            <li>Open this page in Safari or Chrome.</li>
            <li>Add it to your Home Screen from the Share menu.</li>
          </ol>
        ) : (
          <ol>
            <li>
              Tap <ShareIcon /> <b>Share</b>{' '}
              {browser === 'chrome' ? (
                <>in Chrome&apos;s address bar, at the top right (or at the bottom if you moved the bar).</>
              ) : (
                <>
                  in the bar at the bottom. <span className="muted">No Share button? Tap &middot;&middot;&middot; first.</span>
                </>
              )}
            </li>
            <li>
              Tap <b>Add to Home Screen</b>
              {browser === 'safari' ? ' (scroll down if you do not see it).' : '.'}
            </li>
            <li>
              Tap <b>Add</b>, then open <b>Throttle</b> from your Home Screen.
            </li>
          </ol>
        )}
        <button type="button" className="btn wide" data-primary onClick={onClose}>
          Got it
        </button>
        <button type="button" className="link" onClick={onClose}>
          Play in the browser for now
        </button>
      </div>
      {browser !== 'other' && <div className="install-arrow" aria-hidden="true" />}
    </div>
  );
}
