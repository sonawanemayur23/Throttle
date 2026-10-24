# Architecture

The game is a static web app. Everything runs in the browser; there is no server until Phase 3.

## Layers

```
src/
  content/   Plain data: bikes, tracks, career levels. Tune the game here.
  engine/    The race: track generation, simulation, rendering, input, sound.
             No React, no save, no DOM outside render/input/audio. Runs in Node for tests.
  save/      Player progress: versioned guest save, career rules, purchases. Pure functions.
  app/       Glue: GameHost (owns canvas, loop, input, sound), RaceSetup builder, PWA.
  ui/        React screens: title, career, garage, results, settings, pause, help.
  art/       SVG game art. Spec in docs/ART.md.
  test/      Vitest suites and fakes for sound and input.
  main.tsx   Creates the host and mounts React.
```

Imports only point down this list: `ui → app → engine, save, content`; `save → content`; `engine → content` (types only). Never the other way.

## How a race runs

1. A screen calls `raceSetup(save, level, trackId)` (`src/app/setup.ts`). It combines the track, the chosen bike with its upgrades, and the level into a `RaceSetup`.
2. `GameHost.startRace(setup)` hands it to `Game.start()`.
3. Every animation frame the host calls `input.poll()` (gamepad), `game.update(dt)` and `renderer.render(game, dt)`. React is not involved.
4. When the race ends, `Game` fills `game.results`. After 1.6 seconds the host calls `onFinish(results)`.
5. `App` passes the results to `recordRace()` in `src/save/save.ts`, writes the save, and shows the results screen.

Touch controls and the pause and sound buttons live in `index.html`, outside React, so input can bind to them once and re-renders never touch them.

## Engine

| File | Role |
| --- | --- |
| `config.ts` | World constants: segment length, road width, camera, top speed |
| `track.ts` | Builds a looped road from a `TrackDef` seed: curves, hills, scenery, minimap route. Same seed gives the same road on every device |
| `game.ts` | Simulation: player, 6 rivals, police, traffic, combat, weapons, combos, hints, results |
| `render.ts` | Pseudo 3D road renderer on Canvas 2D: sky, road, sprites back to front, particles, HUD, minimap |
| `sprites.ts` | Live drawing for riders, cars, lamps and the start arch |
| `art.ts` | Code-drawn scenery, drawn once into cached images (decision D10). Being replaced by SVG art |
| `svgart.ts` | SVG art from `src/art/`: repaint by color keys, rasterize once, stamp (decision D11, [ART.md](ART.md)) |
| `audio.ts` | Synthesized engine, hits, siren, and the phone audio unlock. Music is a separate bus so the beat does not pump the engine |
| `music.ts` | Original menu and highway loops. Scheduled on the audio clock, ducked while the engine runs |
| `input.ts` | Keyboard, touch steering pad and buttons, gamepad |

### World coordinates

- `d`: distance along the race in world units, not wrapped. The race ends at `d >= track.length`.
- The road is a loop; positions on screen use `d mod length`.
- `x`: lateral offset. `-1` to `1` is tarmac, beyond is off road.
- One segment is 200 units. Top speed for a 1.0 bike is 12,000 units per second, shown as 250 km/h.

### Pseudo 3D renderer

Classic segment projection. Segments are projected front to back for hill occlusion, then sprites and riders are drawn back to front with each segment's clip line. On tall screens the view is cropped from a wider projection (`kx`) so the bike stays big.

## Content

- `content/bikes.ts`: 5 bikes, 3 upgrade kinds, 3 levels each. `bikeStats()` turns a bike plus upgrades into engine numbers.
- `content/tracks.ts`: 4 tracks. Each has a seed, shape knobs (`curves`, `hills`, `traffic`), a palette and weighted scenery.
- `content/career.ts`: 5 levels. Rival speed and aggression ranges, armed riders, police, fines, prizes.

### Add a track

1. Add a `TrackDef` to `TRACKS` with a new seed.
2. If it needs new scenery, add the kind to `SceneryKind`, draw it in `sprites.ts`, size it in `SPRITE_W` in `render.ts`, and add a case in `drawSprite`.
3. Run `npm test`. The track tests check the loop closes and the race length stays in range.
4. The career needs top 3 on every track to unlock a level, so a new track makes the career longer.

### Add a bike

Add a `BikeDef` to `BIKES`. Keep prices in step with prize money in `career.ts`.

## Save

`src/save/save.ts`. Stored in `localStorage` under `throttle.save` as JSON with a `version`. `migrate()` repairs any shape. Save codes (base64 JSON) move progress between devices until accounts exist. Settings also store reduce motion, vibration and the seven race keys. The host applies those to the engine. The engine does not read the save.

## Builds

- `npm run build`: hosted build in `dist/` with a service worker for offline play and install.
- `npm run build:single`: one self-contained HTML file for playtest links (the service worker is skipped there).
