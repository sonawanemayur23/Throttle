import { useState } from 'react';
import type { GameHost } from '../../app/host';
import { exportCode, importCode, newSave, type SaveData } from '../../save/save';

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
    <div className="screen panel solid">
      <div className="card wide">
        <header className="bar">
          <button type="button" className="back" onClick={onBack} aria-label="Back">
            &larr;
          </button>
          <h2 className="h-small">Settings</h2>
          <span />
        </header>

        <div className="settings">
          <label className="switch">
            <input id="setSound" type="checkbox" checked={!save.settings.muted} onChange={() => toggle('muted')} />
            <span>Sound</span>
          </label>
          <label className="switch">
            <input id="setHints" type="checkbox" checked={save.settings.hints} onChange={() => toggle('hints')} />
            <span>Hints in the first 3 races</span>
          </label>

          <div className="group">
            <b>Move your progress to another device</b>
            <p className="muted">Copy this code on this device, then paste it on the other one. Accounts that sync on their own come later.</p>
            <textarea id="myCode" readOnly value={myCode} rows={2} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="ghost" onClick={copy}>
              Copy code
            </button>
            <label htmlFor="loadCode" className="muted">
              Paste a code from another device
            </label>
            <textarea id="loadCode" value={code} onChange={(e) => setCode(e.target.value)} rows={2} placeholder="Paste code here" />
            <button type="button" className="ghost" onClick={load} disabled={!code.trim()}>
              Load progress
            </button>
          </div>

          <div className="group">
            <b>Start over</b>
            {!confirmReset ? (
              <button type="button" className="ghost danger" onClick={() => setConfirmReset(true)}>
                Reset all progress
              </button>
            ) : (
              <div className="row">
                <span className="muted">This deletes your cash, bikes and career on this device.</span>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => {
                    setSave(newSave());
                    setConfirmReset(false);
                    setStatus('Progress reset.');
                  }}
                >
                  Yes, reset
                </button>
                <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                  Keep my progress
                </button>
              </div>
            )}
          </div>
          <p className="msg" role="status">
            {status}
          </p>
        </div>
        <button type="button" className="cta" data-primary onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}
