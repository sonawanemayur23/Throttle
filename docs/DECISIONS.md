# Decisions

One entry per decision that shapes the code. Newest at the bottom. Add an entry before you go against one.

## D1. Canvas 2D now, PixiJS only if profiling demands it (Oct 2026)

The plan named PixiJS for rendering in Phase 2. We kept Canvas 2D. The pseudo 3D road draws in 7 to 11 ms per frame at phone resolution even in a browser with no GPU, and the whole game is 78 KB gzipped. PixiJS would add about 450 KB and a rewrite of the renderer for no visible gain today.
**Revisit when:** a 3 year old Android phone drops below 50 fps in the playtest (task P2-12).

## D2. React for menus only (Oct 2026)

React renders the menus. The race loop runs in `GameHost` outside React, so a re-render can never drop a frame. Touch controls live in `index.html` for the same reason.

## D3. Procedural art and sound (Oct 2026)

Riders, cars, scenery and sound are drawn and synthesized in code. The game loads in under a second, has no licensing risk, and every look is easy to change. An art pass can replace this later (task P2-20).

## D4. Simulation in TypeScript until Phase 4 (Oct 2026)

The simulation costs under 0.1 ms per frame. WebAssembly is planned for Phase 4, where the same simulation must run on the server for fair live races.

## D5. Guest save and save codes before accounts (Oct 2026)

Progress lives in `localStorage` with a versioned format. Players move it between devices with a save code. Sign in and cloud sync move to Phase 3 with the backend, because sync needs a server we do not have yet.

## D6. Original content only (Oct 2026)

No names, art, music or characters from Road Rash or other games, and no real bike or brand names. Bike names are invented (Sparrow, Kestrel, Bison, Shrike, Nightjar).

## D7. Dependencies (Oct 2026)

- `react`, `react-dom`: menus (D2).
- `vite`, `@vitejs/plugin-react`, `typescript`: build.
- `vite-plugin-singlefile`: one-file playtest builds.
- `vitest`: tests.

## D8. Two typefaces from Google Fonts (Oct 2026)

Menus use Saira Condensed (display, 700 to 900) and Saira (body, 400 to 700). They read like motorsport livery and stay legible at small sizes on phones. Loaded from Google Fonts with `display=swap`, so text shows at once in a fallback face (Arial Narrow, Roboto Condensed, system) and swaps when the font arrives. About 60 KB, cached after the first visit. No font files in the repo.

## D9. Garage art as inline SVG (Oct 2026)

Bikes and upgrade parts in the garage are drawn as SVG React components (`src/ui/art/`), one silhouette per bike class. Upgrades show on the bike itself: tyre stripes, exhaust can and flame, armour sliders and plates. SVG stays sharp on every screen, adds a few KB, and needs no image files (in line with D3).

## D10. Cached scenery stamps (Oct 2026)

Scenery (palms, pines, rocks, bushes, cacti, buildings, billboards) is drawn once per variant into small offscreen canvases (`src/engine/art.ts`) and stamped with `drawImage` every frame. That lets each sprite carry gradients, shading and outlines that would be too slow to draw live for 100+ sprites a frame. Six variants per kind, built when a track loads. Riders and cars stay live-drawn because they animate, with a cheaper silhouette when far away.
