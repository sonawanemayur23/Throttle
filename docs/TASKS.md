# Task board

How to use this file: see [AGENTS.md](../AGENTS.md). Take the first `todo` task whose dependencies are `done`. Set it to `doing` with your name before you start.

Status: `todo`, `doing`, `done`, `blocked`, `parked`.

## Next up

State on 25 Oct 2026: Phase 1 done. Phase 2 features done, hosted on Vercel, analytics on Umami working, all 8 art prompts in the game, phone playtest fixes (P2-32 to P2-35) in. Phase 2 closes when the gate is met: a week of Umami data showing day 1 retention and races per day. Work in this order:

1. **P2-12** Phone performance on real devices (auto quality, P2-15, is in; check it picks the right setting).
2. **P2-18** Balance, once there is a week of analytics.

Each task below has a Why, a Do and a Done when. If a task is unclear, ask Mayur before building.

## Phase 1: Feel prototype

**Status: done.** Gate passed (12 of 20 testers played 5 or more races). Details in [PLAN.md](PLAN.md).

## Phase 2: Full single player game

Goal: give players a reason to come back tomorrow. Gate: day 1 retention 35 percent or more, 8 races per player per day.

| ID | Task | Status | Owner | Depends on |
| --- | --- | --- | --- | --- |
| P2-01 | Split engine, content, save and UI layers | done | Claude | |
| P2-02 | Four tracks: Sunset Coast, Red Mesa, Pine Pass, Neon Night | done | Claude | P2-01 |
| P2-03 | Five bikes with engine, tyre and armour upgrades | done | Claude | P2-01 |
| P2-04 | Weapons: club and chain | done | Claude | |
| P2-05 | Police chase and bust from level 2 | done | Claude | P2-01 |
| P2-06 | Cash, loot drops, combo multiplier | done | Claude | |
| P2-07 | Career: 5 levels, top 3 on all tracks unlocks the next | done | Claude | P2-02 |
| P2-08 | Gamepad support | done | Claude | |
| P2-09 | PWA: manifest, icon, offline service worker | done | Claude | |
| P2-10 | Guest save with versioning and save codes | done | Claude | P2-01 |
| P2-11 | Test suite and CI | done | Claude | P2-01 |
| P2-12 | Measure on low end phones; port renderer to PixiJS only if needed | todo | | P2-14 |
| P2-13 | Analytics for the Phase 2 gate | done | Cursor | P2-14 |
| P2-14 | Deploy the hosted build | done | Cursor | |
| P2-15 | Auto quality setting for slow devices | done | Claude | P2-12 |
| P2-16 | Settings: reduce motion, vibration toggle, key remapping | done | Cursor | |
| P2-17 | Original music loop and engine sound polish | done | Cursor | |
| P2-18 | Balance pass from playtest data | todo | | P2-13 |
| P2-19 | Pick the final name and buy the domain | done | Mayur | |
| P2-20 | Art direction pass | parked | | P2-19 |
| P2-21 | Garage art and menu redesign | done | Claude | |
| P2-22 | In-race graphics overhaul | done | Claude | P2-21 |
| P2-23 | SVG art pipeline and board look | done | Claude | P2-22 |
| P2-24 | Riders from Prompt 2 art | done | Claude | P2-23 |
| P2-25 | Police and traffic from Prompt 3 art | done | Claude | P2-24 |
| P2-26 | Props and horizons from Prompts 4 to 6: coast, desert, mountain and city props, 12 horizon strips, sun and moon art | done | Claude | P2-23, art from Mayur |
| P2-27 | Garage art, icons and title art from Prompts 7 and 8 | done | Claude | P2-23, art from Mayur |
| P2-28 | Show upgrades on the garage bike again | done | Claude | P2-27 |
| P2-29 | Sky polish: art-matched sky bands, stars and lamp glows | done | Claude | P2-26 |
| P2-30 | Rider proportions: rerun the updated Prompt 2 | done | Mayur | P2-24 |
| P2-31 | Fix minimap directions and horizon drift on turns | done | Claude | |
| P2-32 | Phone fight controls: punch and kick reachable with one or two thumbs | done | Claude | |
| P2-33 | Game mode: full screen on phones, hides the browser bars | done | Claude | |
| P2-34 | Loading screen: animated logo, 90s tagline, how-to-play tips | done | Claude | |
| P2-35 | Upgrades: show what each level changes, celebrate the purchase | done | Claude | |
| P2-36 | iPhone full screen: Add to Home Screen card for Safari and Chrome, turn-sideways tip | done | Claude | P2-33 |

### P2-12. Measure on low end phones

**Why:** the plan targets 60 fps on a 3 year old Android phone. We have only measured in a desktop browser without a GPU (7 to 11 ms per frame). See decision D1.
**Do:** run the hosted build with `?debug` on 3 phones: one 3 year old Android (Snapdragon 6 series or similar), one recent Android, one iPhone 12 or newer. Race each track for 60 seconds. Record median and worst fps per track in PLAYTEST.md.
**Done when:**
- A table of fps per device per track is in PLAYTEST.md.
- If any device is under 50 fps, a follow-up task exists with the cause (fill rate, sprite count or garbage collection), and D1 is updated.

### P2-13. Analytics for the Phase 2 gate

**Why:** we cannot measure day 1 retention or races per day today.
**Do:** propose a tool in DECISIONS.md first (privacy friendly, free tier, no cookie banner needed; candidates: Plausible, Umami, PostHog). Then send these events from `src/app/`, never from `src/engine/`: `race_start` (track, level, bike), `race_end` (place, time, busted, kos), `purchase` (item, price), `level_unlock`. Use an anonymous random id stored in `localStorage`.
**Done when:**
- Events show in the dashboard from the hosted build.
- No events fire from the single-file playtest build or from `localhost`.
- A saved dashboard shows day 1 retention and races per player per day.
- Open question for Mayur: which tool and which account.

**Notes:** P2-13, Oct 2026: Tool is Umami Hobby (D14). The production build loads `cloud.umami.is/script.js` for website `a01ee3b2-350b-4f26-9af5-19ba2c6e37b1`. Dev, localhost, preview deploys, and the playtest file do not. The app also sends `race_start`, `race_end`, `purchase`, and `level_unlock`. Still doing until a hosted race shows in Umami and two reports are saved: retention (return on day 1) and `race_start` count per player per day.

### P2-14. Deploy the hosted build

**Do:** publish the Vite build where a phone can open it. GitHub Pages was the first plan. Actions never started because the GitHub account is locked for billing, so the host is Vercel instead (decision D13).
**Done when:**
- The game loads from the Vercel URL on a phone.
- The README names Vercel as the host.
- The GitHub Pages workflow is not in the repo.

### P2-15. Auto quality

**Do:** measure frame time over the first 3 seconds of a race. If the median is over 18 ms, lower the canvas pixel cap in `Renderer.resize()` by 30 percent and cut `DRAW_DIST` from 300 to 200. Store the choice in the save `settings`.
**Done when:** a forced slow mode (`?slow` that adds a busy loop) switches quality, and the race still reads clearly at the lower setting.

### P2-16. Comfort and access settings

**Do:** add to Settings: reduce motion (no screen shake, no slow motion), vibration on or off, and keyboard remapping for the 7 race actions. Keep defaults as today. Save in `settings` with a save version bump and migration.
**Done when:** each toggle works, persists, and has a test in `save.test.ts` for the migration.
**Notes:** P2-16, Oct 2026: Save version 3. Reduce motion skips shake and slow motion. Vibration defaults on. Each race action can be put on one key. Menu keys stay reserved.

### P2-17. Music and sound

**Do:** an original synthesized music loop for menus and races (Web Audio, no files, see D3), ducked under the engine. A music volume slider in Settings.
**Done when:** music plays on phones after the first tap, loops without a click, and can be turned off.

### P2-18. Balance pass

**Do:** with analytics data, tune `content/career.ts` prizes and `content/bikes.ts` prices so the median player can buy the Kestrel 600 after about 6 races and reach level 3 in their first week.
**Done when:** the numbers and the reasoning are in this task's Notes and the race tests still pass.

### P2-19. Name and domain

**Owner: Mayur.** Single word, easy to say, domain available. Shortlist from Oct 2026: Revkick, Knocko, Throtto. After the choice: rename the title screen, `index.html`, `manifest.webmanifest`, the save key prefix (with migration), and the README.

### P2-21. Garage art and menu redesign

**Why:** Mayur's review after Phase 2: the garage needs pictures of the bikes and parts, and the menus need to look like a game, not a form.
**Done when:**
- Each bike has its own side-view illustration, and upgrades show on it.
- Engine, tyre and armour parts have illustrations colored by level.
- Spec meters preview the gain of the next upgrade on hover or focus.
- Career shows track previews rendered by the engine.
- Every menu works at 390 px wide with no sideways scroll, with or without the web font.

### P2-22. In-race graphics overhaul

**Why:** same review: race graphics need serious improvement.
**Do:** richer road, sky, scenery, riders and cars, lighting and effects, within the frame budget in AGENTS.md.
**Done when:** before and after screenshots of all 4 tracks are in the pull request, and render time per frame stays under 12 ms in a desktop browser without a GPU.

### P2-27. Icons and title art (Prompt 8), remaining part

**Why:** the menus still use simple code-drawn icons (`src/ui/art/Icons.tsx`) and a text logo. Prompt 8 in the prompts doc asks Claude Design for the icon set and the title art.
**Do:**
1. Mayur pastes Prompt 8 into Claude Design and attaches the HTML here.
2. Extract each `<svg id="...">` from the HTML. Exports from Claude Design escape the markup inside a JSON string: quotes as `\"`, and closing tags as `<\u002Fsvg>`. Read each element as a JSON string and rename `sc-camel-view-box` to `viewBox`.
3. Run `node scripts/clean-svg.mjs in.svg out.svg` on each. Menu art goes in `src/art/ui/` (like `src/art/garage/`), not the top folder, because the race engine registers every top-level file.
4. Load them as data URLs, as `src/ui/art/garageArt.ts` does, and replace `Icons.tsx` and the title logo in `src/ui/screens/Title.tsx`. Keep the logo as text in the page title for screen readers.
5. Add the folder to `src/test/art.test.ts` like the garage block.
**Done when:** every menu screen uses the new icons, the title shows the new logo at 390 px and 1280 px wide, the art tests cover the new folder, and the pull request has before and after screenshots.

### P2-28. Upgrades visible on the garage bike

**Why:** the old code-drawn garage bikes showed upgrades on the bike (tyre color, exhaust, armour plates). The Prompt 7 art is one fixed drawing per bike, so buying an upgrade no longer changes the bike picture. Players should see what they bought.
**Do:** pick one of these and confirm with Mayur first:
- A: ask Claude Design for small overlay pieces per bike (tyre stripe ring, race exhaust, armour plates) in the same 840 x 480 frame, and stack them on the bike in `src/ui/art/BikeArt.tsx` by level.
- B: in code, tint the tyre sidewalls and add a tier-colored badge and a glow under the bike by level.
**Done when:** each upgrade level changes the garage picture in a way you can see at 390 px wide.

### P2-29. Sky polish

**Why:** the horizons are art now, but the sky behind them is still flat bands from `palette.sky` in `src/content/tracks.ts`. In the Prompt 6 composites the sky colors are a little different, and the city has no stars in the art.
**Do:** sample the sky colors from the Prompt 6 composites into each track's `palette.sky`. Check stars only show above the city horizon strip. Optional: a soft glow on the traffic light and on lit windows of the near city strip at night.
**Done when:** a screenshot of each track sits next to its Prompt 6 composite in the pull request, and they match.

### P2-30. Rider proportions

**Why:** the rider art came from the first Prompt 2 text (big helmet, 160 px tail). The updated Prompt 2 asks for bike-first proportions that read better at speed.
**Do:** Mayur reruns the updated Prompt 2. Replace the 10 `src/art/rider-*.svg` files using the same file names, with color keys for body, jacket and helmet (see ART.md). Adjust `RIDER_FIT` in `src/engine/svgart.ts` if the size changes.
**Done when:** riders, police and the player look the same size as now next to cars, and all 10 poses work in a race.

### P2-23 to P2-27. Game art from Claude Design

**Why:** Mayur's review: the code-drawn graphics are not good enough. Mayur makes the art in Claude Design from 8 prompts; agents wire it in.
**Prompts:** "Throttle Art Prompts" doc, https://claude.ai/artifact/T4yS78je4LWzZGi9MSAjz4
**Spec:** [ART.md](ART.md). Format, color keys, anchors and the import steps.
**Done when (each art task):** every asset passes `src/test/art.test.ts`, is drawn in game with its fallback still in place, and the pull request shows all 4 tracks before and after on desktop and phone.

## Phase 3: Social and viral loop

Goal: every player brings in at least one more. Gate: viral coefficient 0.5 or more, 1,000 daily players. Tasks are drafted; refine each before you start.

| ID | Task | Status | Depends on |
| --- | --- | --- | --- |
| P3-01 | Ghost recording: store the player's inputs or positions per race, compact format | done | |
| P3-02 | Challenge link: "beat my score" URL that loads the same track and the sender's ghost | done | P3-01 |
| P3-03 | Auto clip: record the best knockout as a 5 second vertical video with MediaRecorder | todo | |
| P3-04 | Share sheet: Web Share on phones, copy link on desktop, link preview image with score (share done; preview image needs P3-06) | doing | P3-02 |
| P3-05 | Daily race: one seeded track for the world, resets at 00:00 UTC | done | |
| P3-06 | Backend: accounts (guest first, optional sign in), leaderboards, daily race results | todo | |
| P3-07 | Global and friends leaderboards with replay checks for the top 100 | todo | P3-06 |
| P3-08 | Cloud save sync, migrating the guest save | todo | P3-06 |
| P3-09 | Daily streak with a small reward (streak counted and shown; reward is the daily bonus) | doing | P3-05 |
| P3-10 | Trademark check and domain before public launch | todo | P2-19 |

## Phase 4: Live multiplayer and launch

Goal: friends race and fight live from one link. Gate: 10,000 daily players in 30 days, 40 percent of races with a friend.

| ID | Task | Status | Depends on |
| --- | --- | --- | --- |
| P4-01 | Move the simulation to a deterministic fixed step, shared by client and server | todo | |
| P4-02 | Port the simulation to Rust and WebAssembly | todo | P4-01 |
| P4-03 | Room server (Colyseus on Node): create, join by link, up to 6 players, AI fills empty slots | todo | P4-01 |
| P4-04 | Client prediction and server reconciliation for riders and hits | todo | P4-03 |
| P4-05 | Public quick match by skill | todo | P4-03 |
| P4-06 | Game servers in US, EU and Asia | todo | P4-03 |
| P4-07 | Quick chat: 8 preset taunts and emotes | todo | P4-03 |
| P4-08 | Cosmetic shop: skins, outfits, trails. No pay to win | todo | P3-06 |
| P4-09 | Launch: Product Hunt, Reddit, itch.io, CrazyGames, Poki | todo | P4-05 |

## Notes

- P3-05, Oct 2026: daily race with no server. `dailyFor()` in `src/content/daily.ts` picks the track (each track once per 4 day block, never twice in a row) and a level from 1 to 3 from the UTC date, so everyone gets the same race; it changes at 00:00 UTC (05:30 IST). The title screen shows a Daily race card: track, level, time to reset, the player's best today and tries, the day streak, and the first-finish bonus ($500 per level, paid once a day). Daily races and challenges do not change career places and charge no fine when busted. Results show new best, bonus and streak; sharing sends a "beat my daily time" challenge link. Save version 7 adds `daily` and `streak`. Umami: `race_start` gets `mode` (career, daily, challenge) and `daily_end`. Not done: a world leaderboard for the daily (needs P3-06).

- P2-19, Oct 2026: the name is **Throttle Bike**, at throttlebike.com (GoDaddy, DNS pointed at Vercel; the bare domain redirects to www). Browser title, Home Screen name, title and loading screens, install card, challenge messages, README and docs now say Throttle Bike; the "Prototype" label is gone. Code, repo and save keys keep `throttle`, so saves are untouched. Open Graph tags give shared links the name and description; a score image still needs P3-06.

- Fix, Oct 2026 (Mayur, iPhone): the challenge name box dropped letters and a keyboard suggestion started a new race. The game's keyboard handler took every key, even while typing: A steered left, Space and Enter pressed the main button, M muted, P paused. Key presses inside text boxes are now left alone (`isTyping` in `src/engine/input.ts`); text fields stay selectable; Enter or Done in the name box saves the name and closes the keyboard.

- P3-01, P3-02, P3-04 (part), Oct 2026: "Beat my time" challenge links with no server. Every race records the player's road position and lane 4 times a second (`src/engine/ghost.ts`). A finished race packs into a short code (about 0.9 KB for a 85 second race: track, level, bike, time, place, rider name, then 2 bytes a sample) that travels in the link's hash (`#c=`), so it never reaches a server. Opening a link shows a challenge card; the friend races at the sender's level on their own bike against a see-through cyan ghost with the sender's name, a GHOST +/- seconds gap under the health bar, and a ghost dot on the minimap. Results say who won by how much, with "Send it back". Every finished race offers "Challenge a friend": the phone's share sheet, or copy the link on desktop. A name field sets the name on the link (save version 6, `settings.name`). Challenge races pay cash and count in stats but do not change career places. Umami: `challenge_sent`, `challenge_open`, `challenge_result`. Not done: a link preview image with the score (needs a server, P3-06).

- P2-36, Oct 2026: iPhone browsers (Safari and Chrome, which must use Safari's engine) cannot make a page full screen; only video can. From the Home Screen the game opens full screen from the manifest, which Mayur confirmed on an iPhone 14 Pro. So in an iPhone browser tab a card explains Add to Home Screen, with steps for Safari (Share in the bottom bar, or behind the ... button) and for Chrome (Share in the address bar), and an arrow toward the Share button. It shows before the first race and once more after the third. The first two races in a portrait browser tab show a turn-sideways tip, since landscape shrinks the browser bars. Umami gets `app_open` (home screen or browser) and `install_card` (shown, closed) to see if it works. Code: `src/ui/InstallCard.tsx`, helpers in `src/app/gameMode.ts`, tests in `src/test/install.test.ts`.

- P2-15, Oct 2026: auto quality. The host times frame gaps over the first 3 seconds of racing (after a 0.5 second settle, ignoring gaps over 1 second). If the median is over 18 ms it switches to low for good: draw distance 300 to 200 segments, 30 percent fewer canvas pixels (1.4 M to 0.98 M cap). Settings has Graphics: Auto, High, Low; picking Auto again re-measures. Save version 5 adds `quality` and `lowDetected`. `?slow` burns 25 ms a frame to test it. In the GPU-less test browser the median was 117 ms, so it switched to low and saved it.

- Phone playtest, 25 Oct 2026 (Mayur): steering is easier than before; punch and kick sat next to each other and could not be hit reliably; the browser bottom bar spoils the view; the game loads slowly with nothing to look at; upgrades do not say what they change. Analytics (P2-13) confirmed working. Tasks P2-32 to P2-35.
- P2-30, Oct 2026: the rerun Prompt 2 file matched the rider art already in the game, file for file. Accepted as is.
- P2-33, Oct 2026: game mode. Starting a race on a phone enters full screen (Fullscreen API, navigation UI hidden), from the same tap. Settings switch, on by default, save version 4. iPhone Safari cannot make pages full screen; iPhone players see an Add to Home Screen tip instead. Code in `src/app/gameMode.ts`.
- P2-34, Oct 2026: inline loading screen in `index.html` (logo, 90s tagline, sunset road, rotating how-to-play tips). Fades once race art has decoded, between 1.4 and 6 seconds. Google Fonts no longer block the first paint.
- P2-35, Oct 2026: each upgrade card names the current and next part and shows before and after numbers (`upgradeGains()` in `src/content/bikes.ts`); tap a card to preview on the meters; buying flashes the card, pops the bike and shows a level banner.
- P2-32, Oct 2026: research basis: Apple HIG game controls (frequent buttons near the resting thumb, 44 pt minimum, clear press states, combine actions into one control). The right thumb now has one tall fight pad: kick on top (84 px), punch at the bottom where the thumb rests (104 px), 14 px apart, each about 38 percent of the screen wide. Holding a weapon turns the punch zone into the swing (green, with the weapon icon), so the separate weapon button is gone. Brake moved to a pill above the steering pad for the left thumb. Landscape phones put the two zones side by side.
- P2-29, Oct 2026: each track's `palette.sky` now comes from the Prompt 6 sky gradients (stops at 0, 0.55, 1), sampled at the band stops 0, 0.45, 0.8 and 1. Coast and desert changed most (warmer lower sky on the coast, hazier blue on the desert). Stars already sit behind the city strips. Lamp glows were done in P2-26; traffic light and window glows were left out as not worth the frame cost.

- P2-28, Oct 2026: option B (code, no new art). Each upgrade shows on the garage, title and career bike in its tier color: tyres get a colored sidewall ring, engine an underglow on the floor, armour an outline around the whole bike that thickens per level. Wheel positions per bike are in `WHEELS` in `src/ui/art/BikeArt.tsx`. Option A (overlay art from Claude Design) is still open if the look needs more.

- P2-27 part 2, Oct 2026: 12 game icons and 2 title scenes from Prompt 8, in `src/art/ui/`, loaded by `src/app/uiArt.ts`. Icons are in the touch buttons (punch, kick, brake, club or chain), the pause and sound buttons (sound swaps on and off), results (trophy for a top 3 finish, police when busted, cash by earnings), and locks on career levels and garage bikes. The title screen shows the wide scene on landscape screens and the tall one on portrait, with the logo in the clear top third; the bike picture moved off the title. Title scenes are about 50 KB, so the art test allows 60 KB for `title-*` only. The menu tile icons (garage, how to play, settings) were not in Prompt 8 and stay code-drawn.

- P2-31, Oct 2026: the minimap was north-up over the whole track, so a right bend looked like a left whenever the route headed down, and loops crossed. It is now heading-up: it shows the stretch around the rider (10 percent of the track), turned so the rider points up, with an arrow for the rider. The route's turn rate is softer (0.003 per curve unit). The horizon slid far too slowly on turns (the rate was scaled by frame time twice), and the sun and stars jumped across the screen when the offset went negative. The slide is now about 0.15 screen widths per second on a hard bend for the near strip, layers move at 0.3, 0.55 and 1, and the sun wraps outside the screen.

- P2-17, Oct 2026: five original Web Audio loops (menu, plus one per highway), ducked under the engine, music slider in Settings, save version 2 so old saves gain a music level.
- P2-14, Oct 2026: GitHub Pages could not publish because Actions is locked by a billing failure. The hosted build is on Vercel. The Pages workflow is removed.
- P2-27 part 1, Oct 2026: 5 garage bikes with their own liveries and 9 upgrade parts from Prompt 7, on the garage, title and career screens. Files in `src/art/garage/`, loaded by `src/ui/art/garageArt.ts`, checked by the art tests. The old code-drawn bikes and parts are removed. Upgrades no longer show on the bike (see P2-28).
- P2-26, Oct 2026: roadside props for all 4 tracks from Prompts 4 and 5 (coast palms, billboards, lifeguard towers; desert cacti, windmills, signs; mountain pines, logs, rock faces, curve signs; city towers, shopfronts, lamps, traffic lights, bus stops). Props share one scale (`PROP_SCALE`), so the art sheet sizes hold. Billboards, desert signs and shopfronts get words printed by the game. Lamps and traffic lights stand on their pole and reach over the road; lamps glow at night. 12 horizon strips from Prompt 6 tile with parallax, with a ground fill below; sun and moon from art. Wide strips rasterize at a capped size for phone memory. City strips were shrunk under 40 KB by merging same-color rects. Frame time 4 to 13 ms on desktop and phone in a GPU-less browser.
- P2-25, Oct 2026: police in 3 poses with a flashing light bar (two variants, one half dimmed, plus a red or blue glow), 6 traffic vehicles (sedan, hatchback, SUV, van, pickup, semi) with weights and per-kind speeds, semi hit box 1.35 times a car, tail light glows read from each asset's `tail` rects. Every in-race sprite except some scenery now comes from Claude Design.
- P2-24, Oct 2026: 10 rider poses from Prompt 2 in game (ride, punch, kick, hurt, club and chain hold and swing, two crash poses), mirrored for the left, repainted per rider, preloaded per race. This art came from the earlier Prompt 2 text (big helmet, 160 px tail); rerunning the updated Prompt 2 only needs the 10 files replaced. Police stay code-drawn until Prompt 3.
- P2-23, Oct 2026: SVG art pipeline (repaint by color keys, rasterize once per size bucket, stamp with fallback), clean-svg import script, art tests, board car, palm, pine and rock in game, flat banded sky, striped sun, flat moon, outlined ridges.
- P2-22, Oct 2026: cached high-detail scenery, shaded riders and cars with glowing lights, tyre tracks, edge lines, kerb shoulders, tinted clouds, ridge gradients, horizon haze, night headlight and road studs, additive sparks, vignette, HUD plates. Steady render 6 to 12 ms on desktop without a GPU. Fixed: the player's bike color was always black in races.
- P2-21, Oct 2026: SVG art for 5 bikes and 3 parts, new menu design (Saira type, angled panels), engine-rendered track previews.
- P2-01 to P2-11, Oct 2026: done in one pass. Engine takes a `RaceSetup`; content is data; save is versioned; React menus over a canvas loop; 29 tests including a bot race on every track; CI on push.
