import type { Screen } from '../App';
import { bikeById } from '../../content/bikes';
import { levelDef } from '../../content/career';
import { unlockedLevel, type SaveData } from '../../save/save';
import { IconBook, IconGear, IconWrench } from '../art/Icons';
import { titleUrl } from '../../app/uiArt';
import { isIOS, isImmersive, isTouchDevice } from '../../app/gameMode';
import { money } from '../format';

export function Title({
  save,
  go,
}: {
  save: SaveData;
  go: (s: Screen) => void;
}) {
  const lvl = levelDef(unlockedLevel(save));
  const bike = bikeById(save.selectedBike);
  const fresh = save.stats.races === 0;
  return (
    <div className="scr center title-scr">
      {/* Title scene from the Prompt 8 art: wide on landscape screens, tall on portrait. */}
      <picture className="title-bg" aria-hidden="true">
        <source media="(orientation: portrait)" srcSet={titleUrl("tall")} />
        <img src={titleUrl("wide")} alt="" />
      </picture>
      <div className="wrap narrow title">
        <div className="title-top">
          <div className="eyebrow">Prototype</div>
          <h1 className="wordmark display">Throttle</h1>
          <p className="tagline">Race. Punch. Kick. Win.</p>
        </div>
        <div className="title-bottom">
          {!fresh && (
            <div className="status-strip">
              <span>
                Level {lvl.level} {lvl.name}
              </span>
              <span>{bike.name}</span>
              <span className="money">{money(save.cash)}</span>
            </div>
          )}
          {isIOS() && isTouchDevice() && !isImmersive() && <p className="ios-tip">For full screen: tap Share, then Add to Home Screen.</p>}
          <div className="actions">
            <button
              type="button"
              className="btn wide"
              data-primary
              onClick={() => go("career")}
            >
              {fresh ? "Start career" : "Continue"}
            </button>
            <div className="tiles">
              <button
                type="button"
                className="tile"
                onClick={() => go("garage")}
              >
                <IconWrench />
                Garage
              </button>
              <button type="button" className="tile" onClick={() => go("help")}>
                <IconBook />
                How to play
              </button>
              <button
                type="button"
                className="tile"
                onClick={() => go("settings")}
              >
                <IconGear />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
