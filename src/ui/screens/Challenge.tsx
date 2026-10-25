// The card a friend sees when they open a "Beat my time" link (P3-02).

import { bikeById } from '../../content/bikes';
import { levelDef } from '../../content/career';
import { trackById } from '../../content/tracks';
import type { Ghost } from '../../engine/ghost';
import { GameIcon } from '../art/Icons';
import { formatTime } from '../format';

export function ChallengeScreen({ ghost, onRace, onSkip }: { ghost: Ghost; onRace: () => void; onSkip: () => void }) {
  const who = ghost.name || 'A friend';
  return (
    <div className="scr center">
      <div className="wrap narrow challenge">
        <div className="eyebrow">Challenge</div>
        <GameIcon name="trophy" className="podium-ico" />
        <h2 className="display">{who} dares you</h2>
        <p className="beat">
          Beat <b className="display">{formatTime(ghost.time)}</b> on {trackById(ghost.trackId).name}
        </p>
        <p className="muted small">
          Level {ghost.level} {levelDef(ghost.level).name}. {who} rode the {bikeById(ghost.bikeId).name}. You ride your own bike against their ghost: the see-through rider is exactly how they raced.
        </p>
        <div className="actions">
          <button type="button" className="btn wide" data-primary onClick={onRace}>
            Race the ghost
          </button>
          <button type="button" className="btn alt wide" onClick={onSkip}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
