interface Props {
  onResume: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onQuit: () => void;
}

export function Pause({ onResume, onRestart, onHelp, onQuit }: Props) {
  return (
    <div className="scr center" role="dialog" aria-labelledby="pauseTitle">
      <div className="wrap narrow pause">
        <h2 id="pauseTitle" className="display">
          Paused
        </h2>
        <div className="actions">
          <button type="button" className="btn wide" data-primary onClick={onResume} autoFocus>
            Resume
          </button>
          <button type="button" className="btn alt wide" onClick={onRestart}>
            Restart race
          </button>
          <button type="button" className="btn alt wide" onClick={onHelp}>
            How to play
          </button>
          <button type="button" className="btn alt wide" onClick={onQuit}>
            Quit to career
          </button>
        </div>
      </div>
    </div>
  );
}
