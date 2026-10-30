# The Little Wildworks

A small 3D browser game made for one family: you are the new Keeper of a tiny island where
peculiar creatures have ideas slightly too big for them. Help each one with its tiny ambition,
build four playful toys together, and hold the first Moon Picnic on Lantern Rise.

No villains, no fighting, no losing, no shop. Everything is made from the
*Little Wildworks* asset pack (models, island kit, icons, sounds, story data).

## How to play

1. Press **Play**. (Sound starts after this tap/click; the speaker button turns it off.)
2. Walk to the glowing goal. The chip at the top always says what to try next, and a trail of
   sparkles shows the way.
3. When something can be done, a ring appears under it and the Action button (or the prompt at
   the bottom) says what will happen: *Nudge*, *Untie*, *Grow*, *Ride!* …
4. New friends follow you. Bring the right friend to a project and press Action:
   - **Sprout** friends grow the **leaf slide** (meadow),
   - **Splash** friends float the **lotus steps** (pond),
   - **Gust** friends spin the **canopy pinwheel**,
   - **Glimmer** friends light the **picnic lanterns** (Lantern Rise).
5. Every finished project is a toy you can play again: ride the slide (steer into a ring), hop the
   singing pads, turn the wind arrow, remix the lamps. Each toy has a switch for its two settings.
6. When all four toys are done, ring the bell on Lantern Rise, pick the guest of honour, press
   **Go!** and watch the Moon Picnic. Afterwards you can keep playing and ring the bell again.
7. Four extra friends hide around the island. The **Friends** book shows hints for anyone you have
   not met. **My Friend** (in Friends or the pause menu) lets you recolour, rename and choose a
   favourite habit for one of your friends.

## Controls

| | Mac / keyboard | iPhone / touch |
|---|---|---|
| Walk | W A S D or arrow keys | Drag your left thumb anywhere on the lower left |
| Action | Space or E (Enter also works) | Big round Action button (bottom right) |
| Switch friend | F or Tab | Friend button (above Action) |
| Sound on/off | M | Speaker button (top right) |
| Pause / menu | Esc | Pause button (top right) |
| Skip the picnic show | Esc or Skip | Skip button |

The pause menu also has **Calm motion** (turns off camera zoom nudges and most animation), the
**Save code** (export/import), Credits and New game.

## Saving

The island saves on this device after each stable event (new friend, finished toy, nickname,
settings). If the browser blocks storage (for example some private modes), the game still plays
and shows **Saving is off – Export**; copy the save code and paste it back later with
*Pause → Save code → Load this island*.

## Run it locally

The game is a static site in `docs/` with only relative paths, so any static file server works.

```sh
cd docs
python3 -m http.server 8000
# open http://localhost:8000/
```

Opening `docs/index.html` straight from the file system will not work (browsers block ES modules
and model loading from `file://`).

It is published as a sub-path site (`https://dolilod.github.io/little-wildworks/`); nothing in the
game assumes it lives at the domain root.

## Tests

```sh
npm install        # project-local dev dependencies only: playwright-core, three@0.180.0
npm test           # 12 acceptance test files (28 cases), headless /usr/bin/chromium with SwiftShader WebGL
```

The tests serve `docs/` from an in-process server under `/little-wildworks/` and drive the game with
real keyboard and touch input. Screenshots land in `test-artifacts/` (not committed). A test-only
hook (`window.__ww`) exists only when the page is opened with `?test=1`.
See `TEST_REPORT.md` for results and the playtest checklist.

## Project files

- `docs/` — the game (open `index.html` through a server). `docs/CREDITS.md` lists every source.
- `docs/js/kit/` — the asset pack's world, creature and sound kits.
- `tests/` — acceptance tests; `scripts/` — development screenshot helpers.
- `STATUS.md`, `RUN.log`, `DECISIONS.md`, `TEST_REPORT.md` — build notes.

## Credits

Game design and assets: The Little Wildworks asset pack (original, made for this family project).
Three.js r180 (MIT). Code by the build agent. Full details in [`docs/CREDITS.md`](docs/CREDITS.md).
