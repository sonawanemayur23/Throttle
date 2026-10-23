import type { ReactNode } from 'react';
import { money } from './format';

export function TopNav({ title, onBack, cash }: { title: string; onBack: () => void; cash?: number }) {
  return (
    <header className="topnav">
      <button type="button" className="back" onClick={onBack} aria-label="Back">
        &larr;
      </button>
      <h2 className="display">{title}</h2>
      {cash !== undefined ? <span className="cash money">{money(cash)}</span> : <span />}
    </header>
  );
}

export function Fact({ label, children, bad }: { label: string; children: ReactNode; bad?: boolean }) {
  return (
    <div className={`fact${bad ? ' bad' : ''}`}>
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}
