# Art

How game art is made, imported and drawn. Read this before adding or changing any sprite.

## The look

90s arcade racer poster art, redrawn as clean vector with cel shading.

- Every surface uses exactly 3 flat tones: light, base, shadow. Hard edges. No gradients, blur or glow, except the sky bands.
- Light comes from the upper left. Shadow tones sit on the lower right.
- Outer outline 4 px `#14101F`, inner detail lines 2 px `#14101F` (in the asset's own viewBox).
- Chunky shapes and strong silhouettes that read at 40 px tall.
- Original designs only. No real brands, logos, bike or car models, and nothing from existing games.

The art direction board that set this look, and all prompts for the remaining art, live in the "Throttle Art Prompts" doc (link in docs/TASKS.md, task P2-23).

## File format

One SVG file per asset in `src/art/`, named `<group>-<thing>.svg`, for example `coast-palm-tall.svg`.

- Root element: `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H">`.
- Allowed elements: `path`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line`, `g`. Fills and strokes as attributes.
- Not allowed: `script`, `image`, `filter`, `text`, `foreignObject`, links, `style` attributes, `data-*` attributes.
- Transparent background. No ground plane, no cast shadow: the engine draws contact shadows.
- **Anchor:** the asset's ground contact point is the bottom center of the viewBox. The engine places every sprite by that point.
- Under 40 KB per file.
- Actions and overhangs face **right**. The engine mirrors for the left.

`npm test` checks all of this for every file in `src/art/` (`src/test/art.test.ts`).

## Color keys

Assets that come in many colors are painted once in key colors. The engine swaps each key for the rider's or car's own color, deriving the light and shadow tones.

| Key | Base | Light | Shadow | Used for |
| --- | --- | --- | --- | --- |
| body | `#FF00FF` | `#FF80FF` | `#A000A0` | Bike bodywork, car paint |
| jacket | `#00FFFF` | `#80FFFF` | `#00A0A0` | Rider jacket |
| helmet | `#FFFF00` | `#FFFF99` | `#A0A000` | Rider helmet |

Use these exact values and nowhere else in the drawing.

Rider poses and the state that shows them, in order of priority: `rider-crash-a` and `rider-crash-b` (down, early and late), `rider-kick`, `rider-punch`, `rider-club-swing` or `rider-chain-swing`, `rider-hurt` (just hit), `rider-club-hold` or `rider-chain-hold`, `rider-ride`. Poses face right and are mirrored when the action is on the left. Mapping lives in `riderPose()` in `src/engine/sprites.ts`.

Special classes the engine looks for, on `rect` elements: `tail` (tail lights, glow at night), `light-a` and `light-b` (police light bar halves). The engine reads each class's rects from the file to place glows, and flashes the light bar by drawing two variants with one half dimmed. Keep these lights as plain `rect` elements.

## Adding art

1. Save the SVG from Claude Design (or any tool). If it came inside an HTML page, copy one `<svg>` element into its own file.
2. Clean it into the game format:

   ```bash
   node scripts/clean-svg.mjs in.svg src/art/coast-palm-tall.svg
   # If the drawing uses its own colors where a key belongs, map them:
   node scripts/clean-svg.mjs in.svg src/art/car-sedan.svg --key=body:#C23A30,#E86A58,#8A2522
   ```

   The script strips editor attributes, sets the size from the viewBox, rejects unsafe elements and swaps colors into keys.
3. Register it in `ART` in `src/engine/svgart.ts`: import it with `?raw`. Riders and cars take a `fit`, the drawn width as a multiple of the sprite width the renderer passes in. Props ignore `fit`: they all draw at `PROP_SCALE` world units per viewBox pixel, so draw props at their true relative size. Signs list their blank `panels` so the game can print words on them. Props with a pole at one side set `ax` (ground point) and `mirror` in `PROP_PLACE` in `src/engine/render.ts`.
4. Use it: for scenery, map the scenery kind per track in `SVG_SCENERY` in `src/engine/render.ts` (sign words live in `SIGN_WORDS`); for cars and riders, call `svgArt.draw()` in `src/engine/sprites.ts`.
5. Run `npm run check`, then compare a race before and after with `npm run build:single`.

## How the engine draws it

`src/engine/svgart.ts`:

1. **Repaint:** swap color keys in the SVG text.
2. **Rasterize once:** load it as an image, draw it into a canvas at a size bucket (64, 128, 256, 512 or 1024 px tall), and cache that canvas per asset, color and bucket.
3. **Stamp:** `drawImage` the cached canvas each frame, anchored at bottom center.

Until an image has loaded, `draw` returns false and the old code-drawn sprite is used, so the game never waits on art. Art is a few KB per asset and adds nothing to frame time after the first draw.

## Status

| Asset group | Source | In game |
| --- | --- | --- |
| Traffic: sedan, hatchback, SUV, van, pickup, semi | Prompt 3 | All traffic, repainted per car (semi keeps its colors) |
| Coast props: palms, shrub, rock, lifeguard tower, billboard | Prompt 4 | Coast; billboards carry game-printed words |
| Desert props: cacti, rock, bush, windmill, roadside sign | Prompt 4 | Desert; signs carry game-printed words |
| Mountain props: tall, short and dead pines, boulder, log pile, rock face with waterfall, curve sign | Prompt 5 | Mountain |
| City props: 3 towers, shopfront, street lamp, traffic light, bus stop | Prompt 5 | City; shop signs carry neon words, lamps glow at night |
| Sky bands, sun, moon, ridges | Code, matched to the board | All tracks |
| Riders, 10 poses | Prompt 2 | All riders, repainted per rider |
| Police, 3 poses | Prompt 3 | Police chases, light bar flashes |
| Horizons | Prompt 6 | Not yet; code-drawn |
| Garage bikes and parts | Prompt 7 | Not yet; code-drawn SVG |
| Icons, title art | Prompt 8 | Not yet |
