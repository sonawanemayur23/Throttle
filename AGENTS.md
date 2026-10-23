# Agent guide

Read this first. It tells any coding agent (Claude, Codex, Cursor or a person) how to work on this repo without breaking it.

## What this is

A browser motorbike combat racer. Race on highways, punch and kick rivals off their bikes, outrun the police. Plays from a link on phone and desktop. Working codename **throttle**; the final name is not chosen yet.

- Product plan and phases: [docs/PLAN.md](docs/PLAN.md)
- Task board with IDs, status and acceptance criteria: [docs/TASKS.md](docs/TASKS.md)
- How the code fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Decisions and why: [docs/DECISIONS.md](docs/DECISIONS.md)
- How we test with players: [docs/PLAYTEST.md](docs/PLAYTEST.md)

## Setup

```bash
npm install
npm run dev            # http://localhost:5173, add ?debug for fps and window.__game
npm run check          # typecheck + tests. Must pass before every commit.
npm run build          # hosted PWA build in dist/
npm run build:single   # one HTML file in dist-single/ for playtest links
```

Node 22. No other services needed.

## How to pick up work

1. Open [docs/TASKS.md](docs/TASKS.md). Take the first task marked `todo` whose dependencies are `done`.
2. Change its status to `doing` and put your agent or name in Owner. Commit that line alone, so two agents never take the same task.
3. Work on a branch named after the task: `p2-14-pages-deploy`.
4. Meet every acceptance criterion in the task. Add or update tests for any rule you change.
5. Run `npm run check`. Run `npm run build:single` if you touched rendering, input or UI.
6. Set the task to `done`, add one line to its Notes with what changed, and open a pull request with the task ID in the title.

If a task is unclear or too big, split it in TASKS.md into smaller tasks with new IDs before you start. Do not guess at product decisions: add an open question to the task and stop.

## Rules

**Keep the layers apart.** See ARCHITECTURE.md.
- `src/engine/` never imports React, `src/ui/` or `src/save/`. It must run in Node for tests.
- `src/content/` is plain data. Tune numbers there, not in the engine.
- `src/save/` holds every rule that reads or writes the player's progress, as pure functions.
- `src/ui/` is React for menus only. The race loop never runs through React state.

**Never break a save.** The save format is versioned (`SAVE_VERSION` in `src/save/save.ts`). If you change its shape, bump the version and extend `migrate()` so old saves load. Add a test with an old save.

**Performance budget.** 60 fps on a 3 year old Android phone. Simulation under 1 ms per frame, render under 8 ms. Playtest build under 3 MB. No per-frame allocations in hot loops (`render`, `update`).

**No outside assets yet.** Art and sound are drawn and synthesized in code. Do not add image, audio or font files without a decision in DECISIONS.md.

**Original content only.** No names, art, music, tracks or characters from Road Rash or any other game. No real brand or bike model names.

**New dependencies** need a line in DECISIONS.md saying why.

**Tests.** `src/test/` runs with Vitest in Node. The race tests drive a bot through a full race on every track; keep them passing and keep races between 55 and 110 seconds.

## Writing in the game

Player-facing text is plain, short and specific. No contractions, no long dashes, no jargon. Say what a button does ("Race again", "Buy for $18,000"). Errors say what to do next ("You need $2,300 more").

## Commit style

Imperative subject under 70 characters, task ID first when there is one: `P2-14 Deploy to GitHub Pages`. Body says what changed and why.
