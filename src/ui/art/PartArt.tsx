// Upgrade part pictures from src/art/garage (Prompt 7), one drawing per level.
// A soft glow in the tier color sits behind: stock steel, bronze, silver, gold.

import { useId } from 'react';
import type { UpgradeKind } from '../../content/bikes';
import { TIER } from './BikeArt';
import { partImage } from './garageArt';

export function PartArt({ kind, level, className }: { kind: UpgradeKind; level: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const tier = TIER[Math.max(0, Math.min(3, level))];
  return (
    <svg className={className} viewBox="0 0 256 256" aria-hidden="true">
      <defs>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={tier} stopOpacity="0.45" />
          <stop offset="1" stopColor={tier} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="128" cy="128" r="124" fill={`url(#glow-${uid})`} />
      <image href={partImage(kind, level)} x="8" y="8" width="240" height="240" />
    </svg>
  );
}
