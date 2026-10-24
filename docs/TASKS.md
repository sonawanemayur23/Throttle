# Task board

How to use this file: see [AGENTS.md](../AGENTS.md). Take the first `todo` task whose dependencies are `done`. Set it to `doing` with your name before you start.

Status: `todo`, `doing`, `done`, `blocked`, `parked`.

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
| P2-13 | Analytics for the Phase 2 gate | todo | | P2-14 |
| P2-14 | Deploy the hosted build to GitHub Pages | todo | | |
| P2-15 | Auto quality setting for slow devices | todo | | P2-12 |
| P2-16 | Settings: reduce motion, vibration toggle, key remapping | todo | | |
| P2-17 | Original music loop and engine sound polish | todo | | |
| P2-18 | Balance pass from playtest data | todo | | P2-13 |
| P2-19 | Pick the final name and buy the domain | todo | Mayur | |
| P2-20 | Art direction pass | parked | | P2-19 |
| P2-21 | Garage art and menu redesign | done | Claude | |
| P2-22 | In-race graphics overhaul | done | Claude | P2-21 |
| P2-23 | SVG art pipeline and board look | done | Claude | P2-22 |
| P2-24 | Riders from Prompt 2 art | done | Claude | P2-23 |
| P2-25 | Police and traffic from Prompt 3 art | done | Claude | P2-24 |
| P2-26 | Props and horizons from Prompts 4 to 6. Coast and desert props (Prompt 4) done; mountain and city props (Prompt 5) and horizons (Prompt 6) wait on art | in progress | Claude | P2-23, art from Mayur |
| P2-27 | Garage art and icons from Prompts 7 and 8 | blocked | Claude | P2-23, art from Mayur |

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

### P2-14. Deploy to GitHub Pages

**Do:** add `.github/workflows/deploy.yml` that runs `npm ci`, `npm run check`, `npm run build`, and publishes `dist/` to GitHub Pages on every push to `main`. `vite.config.ts` already uses `base: './'`, so the site works under a sub path.
**Done when:**
- The game loads at the repo's Pages URL on a phone and installs to the home screen.
- Offline reload works after the first visit (service worker).
- The README links the live URL.
- Mayur enables Pages in the repo settings (Source: GitHub Actions).

### P2-15. Auto quality

**Do:** measure frame time over the first 3 seconds of a race. If the median is over 18 ms, lower the canvas pixel cap in `Renderer.resize()` by 30 percent and cut `DRAW_DIST` from 300 to 200. Store the choice in the save `settings`.
**Done when:** a forced slow mode (`?slow` that adds a busy loop) switches quality, and the race still reads clearly at the lower setting.

### P2-16. Comfort and access settings

**Do:** add to Settings: reduce motion (no screen shake, no slow motion), vibration on or off, and keyboard remapping for the 7 race actions. Keep defaults as today. Save in `settings` with a save version bump and migration.
**Done when:** each toggle works, persists, and has a test in `save.test.ts` for the migration.

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

### P2-23 to P2-27. Game art from Claude Design

**Why:** Mayur's review: the code-drawn graphics are not good enough. Mayur makes the art in Claude Design from 8 prompts; agents wire it in.
**Prompts:** "Throttle Art Prompts" doc, https://claude.ai/artifact/T4yS78je4LWzZGi9MSAjz4
**Spec:** [ART.md](ART.md). Format, color keys, anchors and the import steps.
**Done when (each art task):** every asset passes `src/test/art.test.ts`, is drawn in game with its fallback still in place, and the pull request shows all 4 tracks before and after on desktop and phone.

## Phase 3: Social and viral loop

Goal: every player brings in at least one more. Gate: viral coefficient 0.5 or more, 1,000 daily players. Tasks are drafted; refine each before you start.

| ID | Task | Status | Depends on |
| --- | --- | --- | --- |
| P3-01 | Ghost recording: store the player's inputs or positions per race, compact format | todo | |
| P3-02 | Challenge link: "beat my score" URL that loads the same track and the sender's ghost | todo | P3-01 |
| P3-03 | Auto clip: record the best knockout as a 5 second vertical video with MediaRecorder | todo | |
| P3-04 | Share sheet: Web Share on phones, copy link on desktop, link preview image with score | todo | P3-02 |
| P3-05 | Daily race: one seeded track for the world, resets at 00:00 UTC | todo | |
| P3-06 | Backend: accounts (guest first, optional sign in), leaderboards, daily race results | todo | |
| P3-07 | Global and friends leaderboards with replay checks for the top 100 | todo | P3-06 |
| P3-08 | Cloud save sync, migrating the guest save | todo | P3-06 |
| P3-09 | Daily streak with a small reward | todo | P3-05 |
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

- P2-25, Oct 2026: police in 3 poses with a flashing light bar (two variants, one half dimmed, plus a red or blue glow), 6 traffic vehicles (sedan, hatchback, SUV, van, pickup, semi) with weights and per-kind speeds, semi hit box 1.35 times a car, tail light glows read from each asset's `tail` rects. Every in-race sprite except some scenery now comes from Claude Design.
- P2-24, Oct 2026: 10 rider poses from Prompt 2 in game (ride, punch, kick, hurt, club and chain hold and swing, two crash poses), mirrored for the left, repainted per rider, preloaded per race. This art came from the earlier Prompt 2 text (big helmet, 160 px tail); rerunning the updated Prompt 2 only needs the 10 files replaced. Police stay code-drawn until Prompt 3.
- P2-23, Oct 2026: SVG art pipeline (repaint by color keys, rasterize once per size bucket, stamp with fallback), clean-svg import script, art tests, board car, palm, pine and rock in game, flat banded sky, striped sun, flat moon, outlined ridges.
- P2-22, Oct 2026: cached high-detail scenery, shaded riders and cars with glowing lights, tyre tracks, edge lines, kerb shoulders, tinted clouds, ridge gradients, horizon haze, night headlight and road studs, additive sparks, vignette, HUD plates. Steady render 6 to 12 ms on desktop without a GPU. Fixed: the player's bike color was always black in races.
- P2-21, Oct 2026: SVG art for 5 bikes and 3 parts, new menu design (Saira type, angled panels), engine-rendered track previews.
- P2-01 to P2-11, Oct 2026: done in one pass. Engine takes a `RaceSetup`; content is data; save is versioned; React menus over a canvas loop; 29 tests including a bot race on every track; CI on push.
