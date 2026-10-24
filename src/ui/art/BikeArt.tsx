// Side-view bike pictures for the garage, title and career screens, from the
// Claude Design art in src/art/garage (Prompt 7). Each bike has its own livery.

import { useId } from 'react';
import type { UpgradeKind } from '../../content/bikes';
import { bikeImage } from './garageArt';

/** Colors for upgrade levels 0 to 3: stock, bronze, silver, gold. */
export const TIER = ['#8b919c', '#d08a4c', '#dfe4ec', '#ffd34d'];

interface Props {
  bikeId: string;
  color?: string;
  upgrades?: Record<UpgradeKind, number>;
  /** Show a showroom floor and reflection under the bike. */
  stage?: boolean;
  className?: string;
  title?: string;
}

export function BikeArt({ bikeId, stage, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const href = bikeImage(bikeId);
  const id = (s: string) => `${s}-${uid}`;
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
        <mask id={id('reflect')}>
          <rect x="0" y="470" width="840" height="90" fill={`url(#${id('fade')})`} />
        </mask>
      </defs>
      {stage && <ellipse cx="420" cy="472" rx="400" ry="40" fill={`url(#${id('spot')})`} />}
      <ellipse cx="420" cy="471" rx="320" ry="12" fill="#000" opacity="0.4" />
      <image href={href} x="0" y="0" width="840" height="480" />
      {stage && (
        <g mask={`url(#${id('reflect')})`}>
          <image href={href} x="0" y="0" width="840" height="480" transform="translate(0 940) scale(1 -1)" />
        </g>
      )}
    </svg>
  );
}
