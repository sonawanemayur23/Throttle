# Product Plan

Working codename: **throttle**. Final name to be decided (shortlist: Revkick, Knocko, Throtto). Domain must be available before Phase 3.

Live doc: https://claude.ai/artifact/4cRqQPkC7pjs8Pg8bYvcsX

## Summary

A free browser game where you race motorbikes on open highways and punch rivals off their bikes. Anyone can play from a link in 5 seconds, and invite friends to race live. We build it in 4 phases, each with a gate we must pass before moving on.

## The game

One race takes 60 to 90 seconds. You finish, see your score, and start the next race in one tap.

**Core loop**

1. Race on a highway with curves, hills, traffic and cops.
2. Punch and kick rivals off their bikes. Grab their weapons.
3. Earn cash from position, knockouts and near misses.
4. Spend cash on bike upgrades and unlocks.
5. Race again, faster and stronger.

**Feel (the part that makes it addictive)**

- Screen shake and a short slow motion on every knockout
- Speed lines and motion blur above 200 km/h
- Combo multiplier for back to back hits and near misses
- Punchy sound: engine pitch, impact crunch, crash
- Random loot drop from every knocked out rider

**Setting:** global, neutral highways. Coast road, desert, mountain pass, city at night. No region specific theme.

## Viral and replay mechanics

The main growth loop is the invite: every player who sends a race link brings in new players who can play without signing up.

| Mechanic | What the player does | Why it spreads or retains | Phase |
| --- | --- | --- | --- |
| Instant play | Opens link, races in under 5 seconds. No login, no download | Removes every reason to drop off | 1 |
| Short runs | 60 to 90 second races | "One more race" always feels cheap | 1 |
| Juice | Knockouts, slow motion, shake, sound | Makes it feel good to play and to watch | 1 |
| Progression | Upgrades, unlocks, loot, combos | Gives a reason to come back | 2 |
| Challenge link | Sends "beat my score". Friend races your ghost | Async invite, works on any chat app | 3 |
| Auto clips | Game saves best knockout as a 5 second video | Ready for Reels, TikTok, Shorts, Status | 3 |
| Daily race | Same track for everyone each day, global leaderboard, streak | Daily habit and bragging rights | 3 |
| Live race with friends | Creates a room, shares link, up to 6 friends race and fight live | Strongest pull: you play together, now | 4 |
| Public matchmaking | Joins a live race with strangers | Always someone to race | 4 |

**Rule:** no pay to win and no forced ads. Both kill word of mouth. Money comes later from cosmetics only (bike skins, rider outfits, trails).

## Tech stack

React runs the screens around the game. The game itself runs in its own loop, so React never causes a dropped frame.

| Layer | Choice | Why |
| --- | --- | --- |
| UI shell | React, TypeScript, Vite | Menus, HUD, garage, leaderboards |
| Rendering | PixiJS (WebGL) with a pseudo 3D road | 60 fps on mid range phones |
| Physics and rider AI | TypeScript first, Rust to WebAssembly in Phase 4 | Wasm runs the same simulation on client and server for fair live races |
| Audio | Web Audio API | Engine pitch, low latency hits |
| Input | Keyboard, touch, gamepad | Plays well on any device |
| Live multiplayer | WebSocket rooms on Colyseus (Node.js), server decides who wins | Stops cheating, handles invite rooms |
| Backend | Postgres plus Redis | Accounts, scores, leaderboards, daily race |
| Clips | MediaRecorder on the game canvas | No server cost for video |
| Hosting | Static game on a CDN, game servers in 3 regions (US, EU, Asia) | Fast load and low lag worldwide |
| Install | PWA | Home screen icon, instant reload |

**Targets:** first load under 3 MB, playable in under 5 seconds on 4G, 60 fps on a 3 year old Android phone, live race lag under 100 ms in the same region.

## Phase 1: Feel prototype (about 2 weeks)

Goal: prove the game feels great in the hands before we build anything else.

Phase 1 uses TypeScript and Canvas 2D only, with no framework, so we can tune feel fast. Phase 2 moves it into React and PixiJS.

**Build**

- [ ] Pseudo 3D road with curves, hills and one track
- [ ] One bike with throttle, brake, steer, punch, kick
- [ ] 6 AI rivals who race and fight back
- [ ] Traffic cars and crashes
- [ ] Knockout juice: shake, slow motion, sound
- [ ] Keyboard and touch controls
- [ ] Single page link, loads in under 5 seconds

**Gate to Phase 2:** 20 testers play. At least 12 of 20 play 5 or more races in their first session without being asked.

## Phase 2: Full single player game (about 4 weeks)

Goal: give players a reason to come back tomorrow.

- [ ] Move to the full React, TypeScript, PixiJS project
- [ ] 4 tracks: coast, desert, mountain pass, city at night
- [ ] 5 bikes with upgrades (engine, tyres, armour)
- [ ] Weapons: grab from rivals, limited uses
- [ ] Cops that chase and arrest
- [ ] Cash, loot drops, combo multiplier
- [ ] Career mode: 5 levels, harder rivals each level
- [ ] Gamepad support, PWA install
- [ ] Guest save in the browser, optional sign in to sync

**Gate to Phase 3:** day 1 retention at 35 percent or more, average 8 races per player per day.

## Phase 3: Social and viral loop (about 4 weeks)

Goal: every player brings in at least one more player.

- [ ] Challenge link: "beat my score", friend races your ghost on the same track
- [ ] Auto clip of best knockout, 5 second vertical video, one tap share
- [ ] Daily race: one seeded track for the world, resets at 00:00 UTC
- [ ] Global and friends leaderboards
- [ ] Daily streak with a small reward
- [ ] Link previews that show your score and clip on any chat app
- [ ] Trademark check and domain bought before public launch

**Gate to Phase 4:** viral coefficient (new players per existing player) at 0.5 or more, 1,000 daily players.

## Phase 4: Live multiplayer and launch (about 6 weeks)

Goal: friends race and fight each other live, from one shared link.

- [ ] Private rooms: create a race, share the link, up to 6 friends join
- [ ] AI riders fill empty slots so a race never waits
- [ ] Public quick match with players of similar skill
- [ ] Rust to WebAssembly simulation shared by client and server
- [ ] Server decides hits and results, client predicts for smooth play
- [ ] Game servers in US, EU and Asia
- [ ] Voice free quick chat: 8 preset taunts and emotes
- [ ] Cosmetic shop: skins, outfits, trails
- [ ] Public launch: Product Hunt, Reddit, itch.io, CrazyGames, Poki

**Launch success:** 10,000 daily players within 30 days of launch, 40 percent of races played with at least one friend.

## Success metrics

One metric leads: races played with at least one invited friend.

| Metric | Target | Checked from |
| --- | --- | --- |
| Races in first session | 5 or more | Phase 1 |
| Day 1 retention | 35 percent | Phase 2 |
| Day 7 retention | 15 percent | Phase 2 |
| Viral coefficient | 0.5, then 1.0 | Phase 3 |
| Clips shared per 100 players | 10 | Phase 3 |
| Races with a friend | 40 percent | Phase 4 |
| Daily players | 10,000 | 30 days after launch |

## Risks

| Risk | Fallback |
| --- | --- |
| Looks too close to Road Rash | All original art, tracks, music, riders and name. No EA references anywhere |
| Live races lag across continents | Region servers, AI fill, and async ghost races as backup |
| Server cost grows with players | Only live rooms use servers. Solo, ghost and daily races run in the browser |
| Cheating on leaderboards | Server checks replays for daily race and top 100 scores |
| Low end phones drop frames | Auto quality setting, cap effects below 50 fps |

## Open questions

- [ ] Final name and domain
- [ ] Who builds it: solo, a p99soft pod, or a small hired team?
- [ ] Art style: low poly 3D look, pixel art, or clean flat cartoon?
- [ ] Budget for game servers after launch
