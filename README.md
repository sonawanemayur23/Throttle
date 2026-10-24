# throttle

Browser motorbike combat racer. Race on open highways, punch and kick rivals off their bikes, play from a link in 5 seconds.

Working codename. The final name is not decided yet.

## Play

The hosted build is on Vercel. Open that project URL on a phone, then add it to the home screen. After the first visit it keeps working offline. GitHub Pages is not used.

- Plan: [docs/PLAN.md](docs/PLAN.md)
- Current phase: **Phase 2, full single player game** (core built, see [docs/TASKS.md](docs/TASKS.md))

## Run it

```bash
npm install
npm run dev            # local dev server with hot reload
npm run check          # typecheck and tests
npm run build          # hosted PWA build in dist/
npm run build:single   # one self-contained HTML file in dist-single/ for test links
```

Add `?debug` to the URL to expose `window.__game` and `window.__host` for testing.

## Controls

| Action | Keyboard | Phone | Gamepad |
| --- | --- | --- | --- |
| Steer | Left, Right (or A, D) | Hold the left pad, slide further to turn harder | Left stick or d-pad |
| Throttle | Up (or W) | Automatic | Right trigger |
| Brake | Down (or S) | BRAKE | Left trigger |
| Punch | J (or Z) | PUNCH | X |
| Kick | K (or X) | KICK | A or B |
| Swing weapon | L (or C) | Weapon button, shown when you hold one | Y |
| Pause | P or Esc | Pause button, top center | Start |
| Mute | M | Settings | |
| Confirm on menus | Enter or Space | Tap | A |

## The game

- **Career:** 5 levels (Rookie, Street, Pro, Outlaw, Legend). Finish in the top 3 on all 4 tracks to unlock the next level.
- **Tracks:** Sunset Coast, Red Mesa, Pine Pass, Neon Night. Each is generated from a seed, so it is the same on every device.
- **Garage:** 5 bikes and 3 upgrades (engine, tyres, armour) with 3 levels each, paid for with race cash.
- **Weapons:** some riders carry a club (6 swings) or a chain (8 swings, longer reach). Knock them out to take it.
- **Police:** from level 2. If they catch you crashed or crawling, you are busted: the race ends and you pay a fine.
- **Saves:** progress stays on the device. Settings has a save code to move it to another device.

## Working on the code

Start with [AGENTS.md](AGENTS.md). It has the setup, the rules and the task workflow for people and coding agents.

| Doc | What it holds |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Product plan and the 4 phases |
| [docs/TASKS.md](docs/TASKS.md) | Task board with IDs, owners, status and acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, how a race runs, how to add a track or bike |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisions and the reasons behind them |
| [docs/PLAYTEST.md](docs/PLAYTEST.md) | Phase gates and how to run a playtest |

## Status

- Phase 1, feel prototype: **done**, playtest gate passed.
- Phase 2, full single player game: core features done (P2-01 to P2-11). Music is in (P2-17). The hosted build is on Vercel (P2-14). Next: analytics, phone performance, comfort settings, balance.
- Phase 3 and 4: drafted in [docs/TASKS.md](docs/TASKS.md).

Size: about 78 KB gzipped including React. 29 tests, including a bot that finishes a race on every track.
