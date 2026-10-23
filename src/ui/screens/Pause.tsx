interface Props {
  onResume: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onQuit: () => void;
}

export function Pause({ onResume, onRestart, onHelp, onQuit }: Props) {
  return (
    <div className="screen" role="dialog" aria-labelledby="pauseTitle">
      <div className="card">
        <h2 id="pauseTitle">Paused</h2>
        <div className="actions">
          <button type="button" className="cta" data-primary onClick={onResume} autoFocus>
            Resume
          </button>
          <button type="button" className="ghost" onClick={onRestart}>
            Restart race
          </button>
          <button type="button" className="ghost" onClick={onHelp}>
            How to play
          </button>
          <button type="button" className="ghost" onClick={onQuit}>
            Quit to career
          </button>
        </div>
      </div>
    </div>
  );
}
