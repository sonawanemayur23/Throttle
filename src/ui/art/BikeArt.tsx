// Side-view bike pictures for the garage, title and career screens, from the
// Claude Design art in src/art/garage (Prompt 7). Each bike has its own livery.

import { useId } from 'react';
import type { UpgradeKind } from '../../content/bikes';
import { bikeImage } from './garageArt';

/** Colors for upgrade levels 0 to 3: stock, bronze, silver, gold. */
export const TIER = ['#8b919c', '#d08a4c', '#dfe4ec', '#ffd34d'];

/**
 * Wheels in each bike drawing (840 x 480 viewBox): rear and front centers
 * and the tyre's outer radius, read from the art. Used to ring the tyres.
 */
const WHEELS: Record<string, Array<[number, number, number]>> = {
  sparrow: [
    [225, 370, 100],
    [620, 370, 100],
  ],
  kestrel: [
    [222, 368, 102],
    [642, 368, 102],
  ],
  bison: [
    [195, 368, 102],
    [682, 364, 106],
  ],
  shrike: [
    [220, 365, 105],
    [640, 365, 105],
  ],
  nightjar: [
    [210, 365, 105],
    [652, 365, 105],
  ],
};

interface Props {
  bikeId: string;
  color?: string;
  upgrades?: Record<UpgradeKind, number>;
  /** Show a showroom floor and reflection under the bike. */
  stage?: boolean;
  className?: string;
  title?: string;
}

export function BikeArt({ bikeId, upgrades, stage, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const href = bikeImage(bikeId);
  const id = (s: string) => `${s}-${uid}`;
  // Upgrades show on the bike, in the level's tier color:
  // engine = an underglow on the floor below the engine, tyres = colored sidewall rings,
  // armour = an outline around the whole bike, thicker per level.
  const up = upgrades ?? { engine: 0, tyres: 0, armour: 0 };
  const wheels = WHEELS[bikeId] ?? WHEELS.sparrow;
  const engineX = (wheels[0][0] + wheels[1][0]) / 2;
  // Art is 840 x 480 with the wheels on y = 470. The stage adds a floor
  // spotlight and a faded reflection below.
  return (
    <svg className={className} viewBox={stage ? '0 0 840 560' : '0 0 840 480'} role="img" aria-label={title ?? 'Bike'}>
      <defs>
        <radialGradient id={id('spot')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('heat')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={TIER[up.engine]} stopOpacity={0.45 + up.engine * 0.18} />
          <stop offset="1" stopColor={TIER[up.engine]} stopOpacity="0" />
        </radialGradient>
        {up.armour > 0 && (
          <filter id={id('armour')} x="-5%" y="-5%" width="110%" height="110%">
            <feMorphology in="SourceAlpha" operator="dilate" radius={2 + up.armour * 2} result="grown" />
            <feFlood floodColor={TIER[up.armour]} />
            <feComposite in2="grown" operator="in" result="edge" />
            <feMerge>
              <feMergeNode in="edge" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
        <mask id={id('reflect')}>
          <rect x="0" y="470" width="840" height="90" fill={`url(#${id('fade')})`} />
        </mask>
      </defs>
      {stage && <ellipse cx="420" cy="472" rx="400" ry="40" fill={`url(#${id('spot')})`} />}
      <ellipse cx="420" cy="471" rx="320" ry="12" fill="#000" opacity="0.4" />
      {up.engine > 0 && <ellipse cx={engineX} cy="462" rx={170 + up.engine * 30} ry={24 + up.engine * 6} fill={`url(#${id('heat')})`} />}
      <image href={href} x="0" y="0" width="840" height="480" filter={up.armour > 0 ? `url(#${id('armour')})` : undefined} />
      {up.tyres > 0 &&
        wheels.map(([cx, cy, r]) => (
          <circle key={cx} cx={cx} cy={cy} r={r - 13} fill="none" stroke={TIER[up.tyres]} strokeWidth={4 + up.tyres * 2} opacity="0.95" />
        ))}
      {stage && (
        <g mask={`url(#${id('reflect')})`}>
          <image href={href} x="0" y="0" width="840" height="480" transform="translate(0 940) scale(1 -1)" />
        </g>
      )}
    </svg>
  );
}
