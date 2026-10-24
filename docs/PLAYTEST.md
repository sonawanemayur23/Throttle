# Playtests

Each phase ends with a gate. We move on only when the numbers pass.

| Phase | Gate | How we measure today |
| --- | --- | --- |
| 1 | 12 of 20 testers play 5 or more races in their first session | Testers report the race number on the results screen. **Passed.** |
| 2 | Day 1 retention 35 percent or more, 8 races per player per day | Umami Hobby (decision D14). The production site reports. Dev, localhost, and the playtest file do not. |
| 3 | Viral coefficient 0.5 or more, 1,000 daily players | Needs invite tracking (Phase 3) |
| 4 | 10,000 daily players within 30 days, 40 percent of races with a friend | Needs accounts and rooms (Phase 4) |

## Running a Phase 2 test

1. Build: `npm run build:single`, or deploy the hosted build (task P2-14).
2. Send the link to 20 people, half on phones. Do not explain the controls; the first 3 races teach them.
3. Ask each tester on day 2:
   - Did you play again today? How many races?
   - Which level did you reach? Which bike did you buy first?
   - What made you stop?
4. Write the answers in a dated section below.

## What to watch

- First race: did they find the steering pad and the punch button without help?
- Did anyone get busted and quit?
- Did they visit the garage on their own?
- Phones: any device with no sound or under 50 fps? Note model and browser.

## Results

### Phase 1 (Oct 2026)

Gate passed. One bug found: no sound on phones. Fixed in commit "Fix audio on phones".
