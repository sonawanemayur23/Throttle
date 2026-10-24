import { useState } from 'react';
import type { GameHost } from '../../app/host';
import { exportCode, importCode, newSave, type SaveData } from '../../save/save';
import { TopNav } from '../parts';

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
  const myCode = exportCode(save);

  const toggle = (key: 'muted' | 'hints') => {
    const next = { ...save, settings: { ...save.settings, [key]: !save.settings[key] } };
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
        <label className="switch" htmlFor="setHints">
          <span>Hints in the first 3 races</span>
          <input id="setHints" type="checkbox" checked={save.settings.hints} onChange={() => toggle('hints')} />
        </label>

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
