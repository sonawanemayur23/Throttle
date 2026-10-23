// Side-view bike illustrations for the garage. Pure SVG, drawn from shapes,
// so they scale to any screen and add almost nothing to the download.
// Upgrades show on the bike: tyre stripes, exhaust, armour plates.

import { useId } from 'react';
import type { UpgradeKind } from '../../content/bikes';

export type BikeShape = 'naked' | 'tourer' | 'cruiser' | 'superbike' | 'hyper';

export const BIKE_SHAPE: Record<string, BikeShape> = {
  sparrow: 'naked',
  kestrel: 'tourer',
  bison: 'cruiser',
  shrike: 'superbike',
  nightjar: 'hyper',
};

/** Colors for upgrade levels 0 to 3: stock, bronze, silver, gold. */
export const TIER = ['#8b919c', '#d08a4c', '#dfe4ec', '#ffd34d'];

interface Props {
  bikeId: string;
  color: string;
  upgrades?: Record<UpgradeKind, number>;
  /** Show a showroom floor and reflection under the bike. */
  stage?: boolean;
  className?: string;
  title?: string;
}

interface Geo {
  r: number; // wheel radius
  rear: number; // rear axle x
  front: number; // front axle x
  head: [number, number]; // steering head
}

const GEO: Record<BikeShape, Geo> = {
  naked: { r: 44, rear: 102, front: 318, head: [262, 92] },
  tourer: { r: 46, rear: 100, front: 322, head: [264, 88] },
  cruiser: { r: 46, rear: 92, front: 344, head: [282, 96] },
  superbike: { r: 46, rear: 100, front: 322, head: [266, 90] },
  hyper: { r: 47, rear: 98, front: 324, head: [268, 88] },
};

const GROUND = 214;

function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function darken(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function BikeArt({ bikeId, color, upgrades, stage, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const shape = BIKE_SHAPE[bikeId] ?? 'naked';
  const g = GEO[shape];
  const up = upgrades ?? { engine: 0, tyres: 0, armour: 0 };
  const cy = GROUND - g.r;
  const id = (s: string) => `${s}-${uid}`;
  const body = `url(#${id('body')})`;
  const chrome = `url(#${id('chrome')})`;
  const dark = '#17181d';
  const trim = darken(color, 0.45);
  const accent = color === '#16181d' ? '#ffd34d' : lighten(color, 0.55);

  return (
    <svg className={className} viewBox="0 0 420 240" role="img" aria-label={title ?? 'Bike'}>
      <defs>
        <linearGradient id={id('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(color, 0.35)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={darken(color, 0.35)} />
        </linearGradient>
        <linearGradient id={id('chrome')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6fa" />
          <stop offset="0.5" stopColor="#9aa1ad" />
          <stop offset="1" stopColor="#5d636e" />
        </linearGradient>
        <linearGradient id={id('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#3a5d86" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={id('spot')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id('reflect')}>
          <rect x="0" y={GROUND} width="420" height="40" fill={`url(#${id('fade')})`} />
        </mask>
      </defs>

      {stage && <ellipse cx="210" cy={GROUND + 2} rx="200" ry="20" fill={`url(#${id('spot')})`} />}
      <ellipse cx="212" cy={GROUND + 1} rx="150" ry="7" fill="#000" opacity="0.45" />

      <g id={id('bike')}>
        {/* Swingarm */}
        <path d={`M${g.rear} ${cy - 6} L${g.rear + 82} ${cy - 22} L${g.rear + 86} ${cy - 10} L${g.rear} ${cy + 6} Z`} fill={trim} />

        <Wheel x={g.rear} y={cy} r={g.r} tier={up.tyres} rim={chrome} shape={shape} rear />
        <Wheel x={g.front} y={cy} r={shape === 'cruiser' ? g.r - 2 : g.r} tier={up.tyres} rim={chrome} shape={shape} />

        <Engine shape={shape} tier={up.engine} chrome={chrome} />
        <Exhaust shape={shape} tier={up.engine} chrome={chrome} rearX={g.rear} cy={cy} />

        {/* Front fork */}
        <line x1={g.head[0]} y1={g.head[1]} x2={g.front} y2={cy} stroke={chrome} strokeWidth="10" strokeLinecap="round" />
        <line x1={g.head[0] + (g.front - g.head[0]) * 0.55} y1={g.head[1] + (cy - g.head[1]) * 0.55} x2={g.front} y2={cy} stroke="#2a2d34" strokeWidth="12" strokeLinecap="round" />

        <BodyWork shape={shape} body={body} color={color} trim={trim} accent={accent} dark={dark} glass={`url(#${id('glass')})`} head={g.head} />
        <Armour shape={shape} tier={up.armour} />
      </g>

      {stage && (
        <g mask={`url(#${id('reflect')})`} opacity="0.35">
          <use href={`#${id('bike')}`} transform={`translate(0 ${GROUND * 2}) scale(1 -1)`} />
        </g>
      )}
    </svg>
  );
}

function Wheel({ x, y, r, tier, rim, shape, rear }: { x: number; y: number; r: number; tier: number; rim: string; shape: BikeShape; rear?: boolean }) {
  const spokes = shape === 'cruiser' ? 12 : shape === 'naked' ? 6 : 3;
  const rr = r * 0.68;
  const tread = Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2);
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#111216" />
      <circle cx={x} cy={y} r={r - 3} fill="none" stroke="#2b2d33" strokeWidth="2" />
      {/* Tread blocks get deeper with better tyres. */}
      {tread.map((a) => (
        <line
          key={a}
          x1={x + Math.cos(a) * (r - 1)}
          y1={y + Math.sin(a) * (r - 1)}
          x2={x + Math.cos(a) * (r - 4 - tier * 1.5)}
          y2={y + Math.sin(a) * (r - 4 - tier * 1.5)}
          stroke="#26282e"
          strokeWidth="3"
        />
      ))}
      {/* Sidewall stripe shows the tyre upgrade level. */}
      {tier > 0 && <circle cx={x} cy={y} r={rr + 6} fill="none" stroke={TIER[tier]} strokeWidth="2.5" strokeDasharray={`${r * 0.9} ${r * 0.35}`} />}
      <circle cx={x} cy={y} r={rr} fill="#1c1d22" stroke={rim} strokeWidth="4" />
      {!rear && shape !== 'cruiser' && <circle cx={x} cy={y} r={rr * 0.72} fill="none" stroke="#5c626d" strokeWidth="6" strokeDasharray="3 3" />}
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i / spokes) * Math.PI * 2 + 0.3;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + Math.cos(a) * rr}
            y2={y + Math.sin(a) * rr}
            stroke={rim}
            strokeWidth={spokes > 6 ? 1.5 : spokes === 6 ? 3 : 6}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={x} cy={y} r={7} fill="#c9ced6" />
      <circle cx={x} cy={y} r={3} fill="#3a3d45" />
    </g>
  );
}

function Engine({ shape, tier, chrome }: { shape: BikeShape; tier: number; chrome: string }) {
  if (shape === 'cruiser') {
    // V-twin with two finned cylinders.
    return (
      <g>
        <rect x="168" y="146" width="84" height="40" rx="12" fill="#3a3d45" />
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(${190 + i * 42} 150) rotate(${i ? 28 : -28})`}>
            <rect x="-15" y="-46" width="30" height="48" rx="6" fill={chrome} />
            {Array.from({ length: 6 }, (_, k) => (
              <rect key={k} x="-18" y={-42 + k * 7} width="36" height="3" rx="1.5" fill="#6f7580" />
            ))}
          </g>
        ))}
        <circle cx="214" cy="170" r="12" fill={TIER[tier]} stroke="#2a2d34" strokeWidth="3" />
      </g>
    );
  }
  return (
    <g>
      <path d="M170 126 L236 118 L248 168 L176 180 Z" fill="#33363e" />
      {Array.from({ length: 5 }, (_, k) => (
        <line key={k} x1={180 + k * 2} y1={136 + k * 8} x2={238 + k * 2} y2={128 + k * 8} stroke="#555b66" strokeWidth="3" />
      ))}
      <circle cx="196" cy="166" r="11" fill={TIER[tier]} stroke="#1f2127" strokeWidth="3" />
      <rect x="226" y="146" width="18" height="22" rx="4" fill={chrome} />
    </g>
  );
}

function Exhaust({ shape, tier, chrome, rearX, cy }: { shape: BikeShape; tier: number; chrome: string; rearX: number; cy: number }) {
  const can = tier >= 2 ? '#2b2d33' : chrome; // carbon can from level 2
  const flame = tier >= 3;
  if (shape === 'cruiser') {
    return (
      <g>
        <path d={`M232 176 Q 200 196 150 192 L ${rearX - 20} 186`} fill="none" stroke={chrome} strokeWidth="10" strokeLinecap="round" />
        <path d={`M228 168 Q 196 186 150 180 L ${rearX - 16} 174`} fill="none" stroke={chrome} strokeWidth="9" strokeLinecap="round" />
        {flame && <path d={`M${rearX - 22} 180 l -18 -4 l 8 6 l -14 2 l 18 4 Z`} fill="#ff8a3c" />}
      </g>
    );
  }
  if (shape === 'superbike' || shape === 'hyper') {
    // Short underbelly can.
    return (
      <g>
        <path d="M200 182 Q 236 194 262 184" fill="none" stroke={chrome} strokeWidth="8" strokeLinecap="round" />
        <rect x="226" y="180" width="44" height="16" rx="7" fill={can} stroke="#1c1d22" strokeWidth="2" transform="rotate(-6 248 188)" />
        {flame && <path d="M272 186 l 18 -3 l -8 5 l 12 2 l -20 3 Z" fill="#ff8a3c" />}
      </g>
    );
  }
  // Side can under the seat.
  const tx = rearX + 6;
  const ty = cy - 30;
  return (
    <g>
      <path d={`M196 180 Q 170 192 ${tx + 52} ${ty + 18}`} fill="none" stroke={chrome} strokeWidth="8" strokeLinecap="round" />
      <rect x={tx} y={ty} width="58" height="20" rx="9" fill={can} stroke="#1c1d22" strokeWidth="2" transform={`rotate(-14 ${tx + 29} ${ty + 10})`} />
      <rect x={tx - 2} y={ty + 4} width="8" height="12" rx="3" fill="#1c1d22" transform={`rotate(-14 ${tx + 29} ${ty + 10})`} />
      {flame && <path d={`M${tx - 2} ${ty + 16} l -18 2 l 8 -6 l -14 -3 l 20 -2 Z`} fill="#ff8a3c" />}
    </g>
  );
}

interface BodyProps {
  shape: BikeShape;
  body: string;
  color: string;
  trim: string;
  accent: string;
  dark: string;
  glass: string;
  head: [number, number];
}

function BodyWork({ shape, body, trim, accent, dark, glass, head }: BodyProps) {
  const [hx, hy] = head;
  const tailLight = (x: number, y: number) => <rect x={x} y={y} width="10" height="7" rx="2" fill="#ff3b3b" />;
  switch (shape) {
    case 'naked':
      return (
        <g>
          {/* Frame */}
          <path d={`M${hx} ${hy} L 200 132 L 182 148`} fill="none" stroke={trim} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          {/* Tail and seat */}
          <path d="M114 100 L 156 104 L 156 116 L 128 116 Z" fill={body} />
          <path d="M150 104 Q 176 96 206 100 L 206 113 Q 176 115 150 115 Z" fill={dark} />
          {/* Tank */}
          <path d={`M200 100 Q 224 76 ${hx - 2} ${hy - 4} L ${hx + 2} ${hy + 22} Q 232 122 202 118 Z`} fill={body} />
          <path d="M214 92 Q 232 82 250 84" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
          {/* Headlight and bars */}
          <circle cx={hx + 20} cy={hy + 12} r="15" fill="#2a2d34" />
          <circle cx={hx + 22} cy={hy + 12} r="10" fill="#fff6c9" />
          <path d={`M${hx - 10} ${hy - 6} L ${hx + 16} ${hy - 14}`} stroke={dark} strokeWidth="6" strokeLinecap="round" />
          {tailLight(112, 101)}
        </g>
      );
    case 'tourer':
      return (
        <g>
          <path d={`M${hx} ${hy} L 202 134 L 184 148`} fill="none" stroke={trim} strokeWidth="9" strokeLinecap="round" />
          <path d="M108 98 L 160 100 L 158 120 L 124 118 Z" fill={body} />
          <path d="M150 100 Q 180 92 210 98 L 210 112 Q 180 114 150 114 Z" fill={dark} />
          <path d={`M204 98 Q 228 78 ${hx} ${hy - 2} L ${hx + 4} ${hy + 22} Q 232 120 206 118 Z`} fill={body} />
          {/* Half fairing with screen */}
          <path d={`M${hx - 8} ${hy - 6} L ${hx + 30} ${hy - 6} Q ${hx + 46} ${hy + 18} ${hx + 26} ${hy + 46} L ${hx - 4} ${hy + 34} Z`} fill={body} />
          <path d={`M${hx - 4} ${hy - 6} Q ${hx - 4} ${hy - 30} ${hx + 4} ${hy - 36} Q ${hx + 22} ${hy - 28} ${hx + 30} ${hy - 6} Z`} fill={glass} />
          <path d={`M${hx + 14} ${hy + 2} L ${hx + 38} ${hy + 6}`} stroke="#fff6c9" strokeWidth="7" strokeLinecap="round" />
          <path d="M170 128 L 238 120" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          {tailLight(106, 100)}
        </g>
      );
    case 'cruiser':
      return (
        <g>
          <path d={`M${hx} ${hy} L 238 140 L 168 150 L 120 140`} fill="none" stroke={trim} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          {/* Rear fender over the fat tyre */}
          <path d="M44 150 Q 60 102 120 104 L 128 120 Q 76 118 62 156 Z" fill={body} />
          {/* Low seat */}
          <path d="M120 114 Q 150 98 196 112 L 196 124 Q 156 122 122 128 Z" fill={dark} />
          {/* Teardrop tank */}
          <path d="M192 112 Q 222 84 270 98 Q 268 116 236 124 Q 210 126 192 122 Z" fill={body} />
          <path d="M206 106 Q 230 96 258 102" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          {/* Wide bars, round lamp, front fender */}
          <path d={`M${hx - 18} ${hy - 30} Q ${hx - 4} ${hy - 4} ${hx + 6} ${hy}`} fill="none" stroke="#c9ced6" strokeWidth="5" strokeLinecap="round" />
          <circle cx={hx + 24} cy={hy + 14} r="15" fill="#c9ced6" />
          <circle cx={hx + 26} cy={hy + 14} r="10" fill="#fff6c9" />
          <path d="M318 130 Q 344 114 372 136 L 366 140 Q 344 126 322 138 Z" fill={body} />
          {tailLight(44, 140)}
        </g>
      );
    case 'superbike':
      return (
        <g>
          {/* Raised tail */}
          <path d="M96 86 L 168 102 L 162 122 L 120 112 Z" fill={body} />
          <path d="M150 104 Q 174 98 200 104 L 198 114 Q 174 114 152 116 Z" fill={dark} />
          {/* Full fairing */}
          <path d={`M182 104 Q 214 84 ${hx} ${hy - 6} L ${hx + 40} ${hy + 2} Q ${hx + 58} ${hy + 26} ${hx + 36} ${hy + 50} L 252 184 L 192 184 Q 176 150 182 104 Z`} fill={body} />
          <path d={`M${hx - 2} ${hy - 6} Q ${hx} ${hy - 26} ${hx + 10} ${hy - 28} Q ${hx + 30} ${hy - 18} ${hx + 40} ${hy} Z`} fill={glass} />
          <path d={`M${hx + 24} ${hy + 10} L ${hx + 50} ${hy + 16}`} stroke="#fff6c9" strokeWidth="6" strokeLinecap="round" />
          {/* Livery */}
          <path d="M196 120 L 300 112 L 296 124 L 200 134 Z" fill={accent} opacity="0.9" />
          <path d="M210 150 L 270 144" stroke={trim} strokeWidth="10" strokeLinecap="round" opacity="0.6" />
          <circle cx="232" cy="164" r="13" fill="#f4f4f4" />
          <text x="232" y="169" textAnchor="middle" fontSize="15" fontWeight="900" fill="#17181d" fontFamily="system-ui, sans-serif">7</text>
          {tailLight(96, 86)}
        </g>
      );
    case 'hyper':
      return (
        <g>
          <path d="M92 82 L 166 100 L 160 120 L 116 110 Z" fill={body} />
          <path d="M148 102 Q 174 96 200 102 L 198 112 Q 174 112 150 114 Z" fill={dark} />
          <path d={`M180 102 Q 214 80 ${hx} ${hy - 8} L ${hx + 42} ${hy} Q ${hx + 62} ${hy + 26} ${hx + 38} ${hy + 52} L 256 186 L 190 186 Q 172 150 180 102 Z`} fill={body} />
          {/* Winglets */}
          <path d={`M${hx + 22} ${hy + 22} L ${hx + 52} ${hy + 18} L ${hx + 48} ${hy + 28} Z`} fill={dark} />
          <path d={`M${hx - 2} ${hy - 8} Q ${hx} ${hy - 28} ${hx + 12} ${hy - 30} Q ${hx + 32} ${hy - 20} ${hx + 42} ${hy - 2} Z`} fill={glass} />
          <path d={`M${hx + 26} ${hy + 8} L ${hx + 54} ${hy + 12}`} stroke="#bfe9ff" strokeWidth="5" strokeLinecap="round" />
          {/* Carbon panel and twin stripes */}
          <path d="M198 136 L 262 128 L 264 170 L 204 176 Z" fill="#202228" />
          <path d="M200 116 L 304 106" stroke={accent} strokeWidth="5" strokeLinecap="round" />
          <path d="M202 126 L 300 116" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          {tailLight(92, 82)}
        </g>
      );
  }
}

function Armour({ shape, tier }: { shape: BikeShape; tier: number }) {
  if (tier === 0) return null;
  const c = TIER[tier];
  // Level 1: frame sliders. Level 2: plus engine guard. Level 3: plus belly plate.
  return (
    <g>
      <circle cx="214" cy="134" r="7" fill={c} stroke="#1c1d22" strokeWidth="2" />
      {tier >= 2 &&
        (shape === 'cruiser' ? (
          <path d="M252 176 Q 276 140 258 112" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
        ) : (
          <path d="M168 132 Q 160 170 186 188 L 246 186" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />
        ))}
      {tier >= 3 && (
        <g>
          <path d="M180 190 L 256 188 L 250 198 L 186 199 Z" fill={c} stroke="#1c1d22" strokeWidth="2" />
          {[194, 214, 234].map((x) => (
            <circle key={x} cx={x} cy="194" r="2" fill="#1c1d22" />
          ))}
        </g>
      )}
    </g>
  );
}
