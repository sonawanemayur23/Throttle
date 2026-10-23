// Illustrations for the three upgrade kinds. The accent color shows the level:
// stock steel, bronze, silver, gold.

import { useId } from 'react';
import type { UpgradeKind } from '../../content/bikes';
import { TIER } from './BikeArt';

export function PartArt({ kind, level, className }: { kind: UpgradeKind; level: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const tier = TIER[Math.max(0, Math.min(3, level))];
  const metal = `url(#metal-${uid})`;
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef1f6" />
          <stop offset="0.55" stopColor="#8f96a2" />
          <stop offset="1" stopColor="#4a4f59" />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={tier} stopOpacity="0.45" />
          <stop offset="1" stopColor={tier} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill={`url(#glow-${uid})`} />
      {kind === 'engine' && <Engine metal={metal} tier={tier} />}
      {kind === 'tyres' && <Tyre metal={metal} tier={tier} level={level} />}
      {kind === 'armour' && <ArmourPlate metal={metal} tier={tier} />}
    </svg>
  );
}

function Engine({ metal, tier }: { metal: string; tier: string }) {
  return (
    <g>
      {/* Crankcase */}
      <rect x="18" y="52" width="60" height="26" rx="8" fill="#353841" />
      <circle cx="34" cy="65" r="8" fill={tier} stroke="#1c1d22" strokeWidth="2.5" />
      <circle cx="34" cy="65" r="3" fill="#1c1d22" />
      {/* Finned cylinder */}
      <rect x="44" y="18" width="26" height="38" rx="4" fill={metal} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x="40" y={21 + i * 6} width="34" height="2.6" rx="1.3" fill="#5d636e" />
      ))}
      <rect x="49" y="10" width="16" height="10" rx="3" fill={tier} stroke="#1c1d22" strokeWidth="2" />
      {/* Intake and exhaust */}
      <path d="M44 34 L 26 30 L 22 40 L 44 42" fill="#2b2e35" />
      <path d="M70 44 Q 84 46 86 62" fill="none" stroke={metal} strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

function Tyre({ metal, tier, level }: { metal: string; tier: string; level: number }) {
  const blocks = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2);
  return (
    <g>
      <circle cx="48" cy="48" r="38" fill="#121317" />
      {blocks.map((a) => (
        <rect
          key={a}
          x={48 - 3}
          y={10}
          width="6"
          height={5 + level * 1.5}
          rx="1"
          fill="#2a2c33"
          transform={`rotate(${(a * 180) / Math.PI} 48 48)`}
        />
      ))}
      <circle cx="48" cy="48" r="27" fill="none" stroke={tier} strokeWidth="3" strokeDasharray="24 8" />
      <circle cx="48" cy="48" r="22" fill="#1d1e23" stroke={metal} strokeWidth="4" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1="48" y1="48" x2={48 + Math.cos(a) * 20} y2={48 + Math.sin(a) * 20} stroke={metal} strokeWidth="4" strokeLinecap="round" />;
      })}
      <circle cx="48" cy="48" r="6" fill="#c9ced6" />
    </g>
  );
}

function ArmourPlate({ metal, tier }: { metal: string; tier: string }) {
  return (
    <g>
      {/* Back protector: stacked plates on a shield */}
      <path d="M48 8 L 80 18 L 78 54 Q 72 78 48 90 Q 24 78 18 54 L 16 18 Z" fill="#2b2e35" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${24 + i * 1.5} ${22 + i * 15} L ${72 - i * 1.5} ${22 + i * 15} L ${70 - i * 3} ${33 + i * 15} L ${26 + i * 3} ${33 + i * 15} Z`}
          fill={i === 0 ? tier : metal}
          stroke="#1c1d22"
          strokeWidth="1.5"
        />
      ))}
      {[30, 66].map((x) => (
        <circle key={x} cx={x} cy="27" r="2" fill="#1c1d22" />
      ))}
    </g>
  );
}
