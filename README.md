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

| Action | Keyboard | Phone |
| --- | --- | --- |
| Steer | Left, Right (or A, D) | Hold the left pad, slide further to turn harder |
| Throttle | Up (or W) | Automatic |
| Brake | Down (or S) | BRAKE |
| Punch | J (or Z) | PUNCH |
| Kick | K (or X) | KICK |
| Swing weapon | L (or C) | Weapon button, shown when you hold one |
| Pause | P or Esc | Pause button, top center |
| Mute | M | Speaker button |
| Start, race again | Enter or Space | Tap the button |

The same table is in the game under How to play.

## Weapons

Two riders start each race with a weapon. Knock one out to take it, or kick it loose (30 percent chance per kick).

| Weapon | Damage | Reach | Swings |
| --- | --- | --- | --- |
| Club | 48 | 0.40 lane widths | 6 |
| Chain | 38 | 0.52 lane widths | 8 |

Riders who hold a weapon hit you 60 percent harder. A knocked out rider has a 25 percent chance to come back armed.

## HUD

- Top left: place, race time, health, weapon and swings left
- Top center: race progress, pause, sound
- Top right: speed, cash, track minimap (white dot is you, colored dots are rivals, checkered flag is the finish)
- First 3 races show short hints that teach steering, fighting and weapons

## How the code is laid out

| File | What it does |
| --- | --- |
| `src/config.ts` | All tuning numbers: speeds, sizes, counts |
| `src/track.ts` | Builds the looped highway: curves, hills, roadside scenery |
| `src/game.ts` | Simulation: player, 6 rival AIs, traffic, combat, combos, scoring |
| `src/render.ts` | Pseudo 3D road renderer, sky, sprites, particles, HUD |
| `src/sprites.ts` | Procedural art for riders, cars and scenery. No image files |
| `src/audio.ts` | Synthesized engine, hits, crashes. No audio files |
| `src/input.ts` | Keyboard input, touch steering pad, touch buttons |
| `src/main.ts` | Screens, game loop, session stats |

The game loop runs outside any UI framework so the frame rate stays steady. Phase 2 moves the screens to React and rendering to PixiJS, as set out in the plan.

## Phase 1 status

- [x] Pseudo 3D road with curves, hills and one track
- [x] One bike with throttle, brake, steer, punch, kick
- [x] 6 AI rivals who race and fight back
- [x] Traffic cars, crashes, near miss bonus
- [x] Knockout juice: hit stop, slow motion, screen shake, sparks, synthesized sound, phone vibration
- [x] Keyboard and touch controls, with an analog steering pad on phones
- [x] Weapons (club, chain), minimap, How to play screen, pause, first race hints
- [x] Single page build: 58 KB, 21 KB gzipped
- [ ] Playtest with 20 people (gate: 12 of 20 play 5 or more races in one session)

Measured on the first build: races last 72 to 79 seconds, simulation costs under 0.1 ms per frame.
