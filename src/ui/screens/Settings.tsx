import { useEffect, useState } from 'react';
import type { GameHost } from '../../app/host';
import { DEFAULT_KEYS, RACE_ACTIONS, actionLabel, exportCode, importCode, keyLabel, newSave, rebind, type RaceAction, type SaveData } from '../../save/save';
import { TopNav } from '../parts';
import { canFullscreen, enterGameMode, exitGameMode, isIOS, isImmersive } from '../../app/gameMode';

interface Props {
  save: SaveData;
  setSave: (s: SaveData) => void;
  host: GameHost;
  onBack: () => void;
}

export function Settings({ save, setSave, host, onBack }: Props) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [listening, setListening] = useState<RaceAction | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const myCode = exportCode(save);

  useEffect(() => {
    if (!listening) {
      host.cancelListen();
      return;
    }
    host.listenForKey((pressed) => {
      const result = rebind(save.settings.keys, listening, pressed);
      setListening(null);
      if (!result.ok) {
        setKeyError(result.reason);
        return;
      }
      setKeyError(null);
      setSave({ ...save, settings: { ...save.settings, keys: result.keys } });
    });
    return () => host.cancelListen();
  }, [host, listening, save, setSave]);

  const toggle = (key: 'muted' | 'hints' | 'reduceMotion' | 'vibration' | 'gameMode') => {
    const next = { ...save, settings: { ...save.settings, [key]: !save.settings[key] } };
    if (key === 'gameMode') {
      if (next.settings.gameMode) enterGameMode();
      else exitGameMode();
    }
    if (key === 'muted') host.setMuted(next.settings.muted);
    setSave(next);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setStatus('Save code copied.');
    } catch {
      const el = document.getElementById('myCode') as HTMLTextAreaElement | null;
      el?.select();
      setStatus('Copy the selected code.');
    }
  };

  const load = () => {
    const s = importCode(code);
    if (!s) {
      setStatus('That code did not work. Copy the whole code and try again.');
      return;
    }
    setSave(s);
    setCode('');
    setStatus('Progress loaded.');
  };

  return (
    <div className="scr solid">
      <div className="wrap narrow">
        <TopNav title="Settings" onBack={onBack} />

        <label className="switch" htmlFor="setSound">
          <span>Sound</span>
          <input id="setSound" type="checkbox" checked={!save.settings.muted} onChange={() => toggle('muted')} />
        </label>
        <label className="slider" htmlFor="setMusic">
          <span>{save.settings.music === 0 ? 'Music off' : `Music ${Math.round(save.settings.music * 100)}%`}</span>
          <input
            id="setMusic"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(save.settings.music * 100)}
            aria-valuetext={save.settings.music === 0 ? 'Off' : `${Math.round(save.settings.music * 100)} percent`}
            onChange={(e) => {
              const music = Number(e.target.value) / 100;
              host.setMusicVolume(music);
              setSave({ ...save, settings: { ...save.settings, music } });
            }}
          />
        </label>
        <p className="muted small">Original music, made for this game. Menus share a quieter track. Each highway has its own.</p>
        {canFullscreen() ? (
          <>
            <label className="switch" htmlFor="setGameMode">
              <span>Game mode</span>
              <input id="setGameMode" type="checkbox" checked={save.settings.gameMode} onChange={() => toggle('gameMode')} />
            </label>
            <p className="muted small">Full screen while you play on a phone. Hides the browser bars. Swipe down or press back to leave it.</p>
          </>
        ) : (
          isIOS() &&
          !isImmersive() && (
            <p className="muted small">
              <b>Game mode on iPhone:</b> tap Share, then Add to Home Screen. The game then opens full screen, without the browser bars.
            </p>
          )
        )}
        <div className="quality">
          <span>Graphics</span>
          <div className="choices" role="radiogroup" aria-label="Graphics quality">
            {(['auto', 'high', 'low'] as const).map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={save.settings.quality === q}
                className={save.settings.quality === q ? 'on' : ''}
                // Picking Auto again measures afresh.
                onClick={() => setSave({ ...save, settings: { ...save.settings, quality: q, lowDetected: q === 'auto' ? false : save.settings.lowDetected } })}
              >
                {q === 'auto' ? 'Auto' : q === 'high' ? 'High' : 'Low'}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">
          {save.settings.quality === 'auto'
            ? save.settings.lowDetected
              ? 'Auto picked Low on this device for a smoother race.'
              : 'Auto checks the first seconds of a race and drops to Low if this device is slow.'
            : save.settings.quality === 'low'
              ? 'Low draws less road and fewer pixels. Smoother on older phones.'
              : 'High always, even if the race runs slower.'}
        </p>
        <label className="switch" htmlFor="setHints">
          <span>Hints in the first 3 races</span>
          <input id="setHints" type="checkbox" checked={save.settings.hints} onChange={() => toggle('hints')} />
        </label>
        <label className="switch" htmlFor="setMotion">
          <span>Reduce motion</span>
          <input id="setMotion" type="checkbox" checked={save.settings.reduceMotion} onChange={() => toggle('reduceMotion')} />
        </label>
        <p className="muted small">Turns off screen shake and slow motion.</p>
        <label className="switch" htmlFor="setVibration">
          <span>Vibration</span>
          <input id="setVibration" type="checkbox" checked={save.settings.vibration} onChange={() => toggle('vibration')} />
        </label>
        <p className="muted small">Phone buttons buzz when you tap them. Hits buzz during a race.</p>

        <div className="panel group">
          <h3 className="display">Race keys</h3>
          <div className="key-list">
            {RACE_ACTIONS.map((action) => (
              <div className="key-row" key={action}>
                <span>{actionLabel(action)}</span>
                <span className="keys">
                  {(listening === action ? [] : save.settings.keys[action]).map((k) => (
                    <kbd key={k}>{keyLabel(k)}</kbd>
                  ))}
                </span>
                <button
                  type="button"
                  className="btn alt"
                  aria-pressed={listening === action}
                  onClick={() => {
                    setKeyError(null);
                    setListening(listening === action ? null : action);
                  }}
                >
                  {listening === action ? 'Press a key' : 'Change'}
                </button>
              </div>
            ))}
          </div>
          {keyError && (
            <p className="msg" role="status">
              {keyError}
            </p>
          )}
          <button
            type="button"
            className="btn alt"
            onClick={() => {
              setListening(null);
              setKeyError(null);
              setSave({
                ...save,
                settings: {
                  ...save.settings,
                  keys: {
                    left: [...DEFAULT_KEYS.left],
                    right: [...DEFAULT_KEYS.right],
                    up: [...DEFAULT_KEYS.up],
                    down: [...DEFAULT_KEYS.down],
                    punch: [...DEFAULT_KEYS.punch],
                    kick: [...DEFAULT_KEYS.kick],
                    weapon: [...DEFAULT_KEYS.weapon],
                  },
                },
              });
            }}
          >
            Reset keys
          </button>
        </div>

        <div className="panel group">
          <h3 className="display">Move your progress</h3>
          <p className="muted small">Copy this code here, then paste it on your other device. Accounts that sync on their own come later.</p>
          <textarea id="myCode" readOnly value={myCode} rows={2} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn alt" onClick={copy}>
            Copy code
          </button>
          <label htmlFor="loadCode" className="small muted">
            Paste a code from another device
          </label>
          <textarea id="loadCode" value={code} onChange={(e) => setCode(e.target.value)} rows={2} placeholder="Paste code here" />
          <button type="button" className="btn alt" onClick={load} disabled={!code.trim()}>
            Load progress
          </button>
        </div>

        <div className="panel group">
          <h3 className="display">Start over</h3>
          {!confirmReset ? (
            <button type="button" className="btn alt danger" onClick={() => setConfirmReset(true)}>
              Reset all progress
            </button>
          ) : (
            <>
              <p className="small">This deletes your cash, bikes and career on this device.</p>
              <div className="row">
                <button
                  type="button"
                  className="btn alt danger"
                  onClick={() => {
                    setSave(newSave());
                    setConfirmReset(false);
                    setStatus('Progress reset.');
                  }}
                >
                  Yes, reset
                </button>
                <button type="button" className="btn alt" onClick={() => setConfirmReset(false)}>
                  Keep progress
                </button>
              </div>
            </>
          )}
        </div>
        <p className="msg" role="status">
          {status}
        </p>
        <button type="button" className="btn wide" data-primary onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}
