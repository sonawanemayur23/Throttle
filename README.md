# throttle

Browser motorbike combat racer. Race on open highways, punch and kick rivals off their bikes, play from a link in 5 seconds.

Working codename. The final name is not decided yet.

- Plan: [docs/PLAN.md](docs/PLAN.md)
- Current phase: **Phase 1, feel prototype**

## Run it

```bash
npm install
npm run dev            # local dev server with hot reload
npm run build          # production build in dist/
npm run build:single   # one self-contained HTML file in dist-single/ for test links
```

Add `?debug` to the URL to show fps and expose `window.__game` for testing.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | Left, Right (or A, D) | Left thumb buttons |
| Throttle | Up (or W) | Automatic |
| Brake | Down (or S) | BRAKE |
| Punch | J (or Z) | PUNCH |
| Kick | K (or X) | KICK |
| Mute | M | Speaker button |
| Start, race again | Enter or Space | Tap the button |

## How the code is laid out

| File | What it does |
| --- | --- |
| `src/config.ts` | All tuning numbers: speeds, sizes, counts |
| `src/track.ts` | Builds the looped highway: curves, hills, roadside scenery |
| `src/game.ts` | Simulation: player, 6 rival AIs, traffic, combat, combos, scoring |
| `src/render.ts` | Pseudo 3D road renderer, sky, sprites, particles, HUD |
| `src/sprites.ts` | Procedural art for riders, cars and scenery. No image files |
| `src/audio.ts` | Synthesized engine, hits, crashes. No audio files |
| `src/input.ts` | Keyboard and touch input |
| `src/main.ts` | Screens, game loop, session stats |

The game loop runs outside any UI framework so the frame rate stays steady. Phase 2 moves the screens to React and rendering to PixiJS, as set out in the plan.

## Phase 1 status

- [x] Pseudo 3D road with curves, hills and one track
- [x] One bike with throttle, brake, steer, punch, kick
- [x] 6 AI rivals who race and fight back
- [x] Traffic cars, crashes, near miss bonus
- [x] Knockout juice: hit stop, slow motion, screen shake, sparks, synthesized sound, phone vibration
- [x] Keyboard and touch controls
- [x] Single page build: 42 KB, 16 KB gzipped
- [ ] Playtest with 20 people (gate: 12 of 20 play 5 or more races in one session)

Measured on the first build: races last 72 to 79 seconds, simulation costs under 0.1 ms per frame.
