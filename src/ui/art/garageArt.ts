// Garage art from src/art/garage (Claude Design, Prompt 7), as data URLs for
// <image> tags. Bikes are 840 x 480 facing right, wheels on y = 470. Parts are
// 256 x 256, one drawing per upgrade level 1 to 3.

import type { UpgradeKind } from '../../content/bikes';

const raw = import.meta.glob('../../art/garage/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const urls = new Map<string, string>();
for (const [path, svg] of Object.entries(raw)) {
  const name = (path.split('/').pop() as string).replace(/\.svg$/, '');
  urls.set(name, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

export const bikeImage = (bikeId: string) => urls.get(`bike-${bikeId}`) ?? urls.get('bike-sparrow') ?? '';

/** Level 0 is stock, drawn as level 1. */
export const partImage = (kind: UpgradeKind, level: number) => urls.get(`part-${kind}-${Math.max(1, Math.min(3, level))}`) ?? '';
