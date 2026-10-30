# TEST REPORT — The Little Wildworks

Build date: 2026-10-31 (overnight, WIB). Tested commit: see `git log` (last commit before this report).

## Child playtest: NOT RUN

Doli and his son were asleep during this overnight build, so no child has played the game yet.
Nothing in this report is evidence of how an 8-year-old will react. The automated tests below
only show that the game works as built, in a headless browser.

### Playtest checklist for Doli (about 30 minutes)

Before you start: open the game on the iPhone (Safari) and on the Mac, sound on.
Let him play without explaining anything. Sit beside him and write down his exact words.

1. **First minute.** Does he move the Keeper without help? Does he notice Tumbletuft's tumble
   ("...I meant to do that.")? Note how long it takes to reach the seed.
2. **First friend (target: about 3 minutes).** Does he find the seed, take his ramp turn, and
   choose a nickname? Write down the name he picks.
3. **The slide.** Does he ride it again *without being asked*? Does he try to steer into a ring?
   Who did he let go first? (That choice comes back at the picnic.)
4. **Projects.** At the canopy and the pond, does he understand he needs the right friend?
   Watch for the "This needs a Gust friend" hint and whether he uses the Friend button.
5. **Toys.** Does he play with the singing pads, the wind arrow or the lamp remix on his own?
6. **Stuck points.** Note any place he walks in circles, taps repeatedly, or asks "what now?".
   The goal chip (top left) and the sparkle trail should answer that question.
7. **Moon Picnic.** Who does he choose as guest of honour, and why? Does he watch it to the end
   or press Skip? Does he ring the bell again?
8. **Afterwards.** Ask: "What would you tell a friend about this game?" and "What was annoying?"
   Write the answers down word for word. Try My Friend together if there is time.
9. **Device checks.** On the iPhone: sound starts after Play; the stick and the Action button work
   with two thumbs; rotating the phone does not leave the Keeper walking; the game survives
   switching apps and coming back. On both devices: refresh the page and check that friends and
   toys are still there.

## Automated acceptance tests

`npm test` runs 12 test files (28 test cases) one after another in headless system Chromium
(`/usr/bin/chromium`, `--use-angle=swiftshader --enable-unsafe-swiftshader`, no browser download).
The game is served from an in-process server under `/little-wildworks/`, which proves every path is
relative. Story steps are driven with real key presses (WASD/arrows to walk along a navgrid path,
Space to act), real touch events (CDP `Input.dispatchTouchEvent`) and real clicks on dialogs.
The test hook (`window.__ww`, only with `?test=1`) is used to read state, to fast-forward game time
(×2.5–3) and, in two tests, to start from a saved mid-story state.

| # | Test file | What it checks |
|---|---|---|
| 1 | `01-load` | Title → Play at 1280×800 and 390×844 (DPR 3, touch): 0 console errors and warnings, 0 page errors, 0 failed or foreign requests, all 9 GLBs loaded from GLB (no factory fallback). Without `?test=1` there is no test hook. |
| 2 | `02-movement` | WASD and arrows move the Keeper; window blur and `visibilitychange` stop held movement; the touch joystick moves the Keeper; touchend and `pointercancel` stop it; the Action button works while the stick is held (multi-touch). |
| 3 | `03-befriend` | Tumbletuft, Whirli, Puddleloop and Glintot: the creature notices the Keeper and speaks its own intro/request line, the friendship action completes, acceptance happens, nickname custom ("Captain Leaf", "Loopy") and default, the friend becomes the follower and follows. |
| 4 | `04-projects` | Leaf slide, lotus steps, pinwheel canopy, lanterns: meshes swap state, the path/collision changes (meadow gate, walkable pads, gate lamps, bell ready), each toy is replayed (rides, tunes, wind arrow, lamp remix, variant switches), 8 extra Space presses during the helper animation are ignored and the project/events commit once. |
| 5 | `05-branch-order` | Pond-then-wind and wind-then-pond both open Lantern Rise and reach Glintot (walked through the gate with keys). |
| 6 | `06-reachability` | Navgrid BFS from the spawn at each stage: required creature + friendship props + project socket are reachable before that project; the gates block what should be blocked; Siltbell's islet only via the side pad. |
| 7 | `07-win-path` | New game → 4 friends → 4 toys → bell → guest of honour (Whirli) → Go → Skip → final card "The first Moon Picnic, made with Captain Leaf, Whirli, Loopy, Glintot and you." / "Guest of honour: Whirli" → free play (Keeper walks) → bell replay watched in full (≤ 45 s game time) with a new guest. |
| 8 | `08-save-load` | Reload restores friends, projects, nicknames and the My Friend recolour/name/habit; with storage blocked the game plays, never shows "Saved", offers an export code, rejects a bad code with a message, and restores from a good code; a corrupt save and a newer-version save give a fresh island with a clear note; a saved position in the pond or behind a closed gate respawns the Keeper at the start. |
| 9 | `09-optional-and-my-friend` | Foldfern, Kitefin, Siltbell, Hushbulb befriended with real inputs; roster shows all 8 cards, memory book is full; My Friend editor recolours/renames Whirli; it follows in the world, the roster marks it, and the ending lists all eight names including "Puffy Pal" plus "Your own friend Puffy Pal came too!". |
| 10 | `10-layout` | 1280×800, 390×844 and 844×390 with simulated notch/home-indicator insets: every HUD element inside the viewport and safe area, no overlaps, buttons ≥ 48 px, no clipped text, touch controls only on touch devices, pause dialog fits. |
| 11 | `11-english` | No Indonesian words in any content data or visible text (title, credits, HUD, friends, memory book, pause, save code, editor); `<html lang="en">`; menus (incl. credits concept art) load cleanly. |
| 12 | `12-screenshots` | All 20 required screenshots exist in `test-artifacts/` and are real images. |

### Results

Final runs (12 files, 28 test cases, `npm test`, one at a time):

| Run | Code | Result | Wall time |
|---|---|---|---|
| B1 | 7029127 (position-safety fix) | 28/28 pass | 984 s |
| B2 | same, run again immediately | 28/28 pass | 992 s |
| C1 | + toast icon contrast (CSS) | 28/28 pass | 1031 s |
| C2 | same, run again immediately | 28/28 pass | 981 s |
| D | + monitor review fixes (occluder fade, bubble/HUD clamp, name label) | 28/28 pass | 974 s |

Logs: `test-artifacts/final-run-*.log` (not committed). Earlier shakedown runs found and fixed: Escape
closing a dialog also reopened the pause menu; a desktop overlap of the action prompt and the keyboard help;
movement tests depending on frame rate.

## Performance (headless SwiftShader — pessimistic)

SwiftShader is a CPU renderer, so these frame times are far slower than any real phone GPU. They are
recorded only so later device numbers have a baseline. Real-device frame time was **not measured**.

| Scene (1280×800, DPR 1) | frames sampled | p50 frame | p95 frame | draw calls | triangles |
|---|---|---|---|---|---|
| Ordinary play, opening meadow (test 1, run C1) | 20 | 200 ms | 250 ms | 93 | 31,484 |
| Moon Picnic incl. full-island pull-back (test 7, run C1) | 600 | 250 ms | 300 ms | 373 | 42,222 |

The chain reaction lasted 28.0 s of game time with four friends (limit 45 s).

Other budgets (measured from the files and the renderer, not on a device):

- First-play download: 1.75 MB uncompressed (three.js 0.72 MB, 9 GLBs 0.45 MB, game JS ~0.2 MB,
  tiles/icons/data), about 0.38 MB gzip-compressed. Concept art (144 KB) loads only in Credits.
- `docs/` total: 2.0 MB (limit ~15 MB).
- Ordinary play: about 90 draw calls and 31k triangles in the opening view (budget ~150 calls,
  < 50k triangles). The finale's full-island pull-back peaks at ~370 calls (the brief allows the
  finale to exceed the ordinary budget briefly).
- Pixel ratio capped at 1.5; no shadow maps (contact discs); decor, hedges and particles instanced;
  rendering stops while the tab is hidden.

## Screenshots inspected (and what changed because of them)

All screenshots were opened and looked at during the build (desktop and 390×844 mobile):
title, desktop and mobile play, every befriend moment, every finished project, the picnic,
the final card, roster, memory book and the My Friend editor.

- Practice leaf was invisible (moss on moss) → lighter leaf with a teal rim; slide surface lightened too.
- A kit tree hid Tumbletuft's stage → moved back; occluders now also fade for the friend and the goal.
- Siltbell's islet could not be reached (pads did not overlap) → islet moved mid-pond, side pad resized,
  invisible links widen the pad crossing.
- Picnic: the Keeper's seat overlapped the moon lamp on screen → guest seat moved to the far side,
  moon moved above-left.
- Final card captured mid-animation with leftover speech bubbles → bubbles cleared when the show ends.
- Mobile ride shot was too zoomed in → cinematic spans widen on portrait screens.
- Desktop keyboard help overlapped the action prompt (caught by test 10) → moved under the goal chip.
- Element icons were invisible on the dark toasts → cream disc behind toast icons.
- Monitor review: the canopy roof could fully hide the Keeper → roof, rotor, Lantern Rise gate, bell frame and
  Glintot's lantern fade (using real frame time, with a ray at head height too); speech bubbles overlapped the
  goal chip/keyboard help during the slide ride → clamped below the measured HUD strip; the nickname label
  overlapped the thanks bubble → it now floats above the bubble.
- Action label said "Wave" while a target ring was showing (stale after the intro) → label resynced.

## Not verified

- Physical iPhone Safari and Mac Safari (rendering, audio unlock after Play, audio after switching apps,
  two-thumb play, rotation, sustained frame rate, thermal throttling).
- Listening to the synthesized sounds and music (only checked that the audio graph runs without errors).
- First-time session length (target 20–40 minutes), and anything about how a child feels or understands.
