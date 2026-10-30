# Decisions

Each entry: decision, why, and what it trades away. Newest at the bottom of each section.

## Scope and process

- **Child playtest: not run.** Doli and his son were asleep. The BUILD_FIRST gate was replaced by: build the Tumbletuft
  slice first, review it from real screenshots as an 8-year-old would, fix friction, then continue (worker prompt).
- **No bundler.** Plain ES modules + an import map pointing at vendored three r180 (`docs/vendor/three/`). Works from
  any static server and under the `/little-wildworks/` subpath because every path is relative.
- **Minified three builds vendored** (`three.module.min.js` + `three.core.min.js`, ~720 KB) with GLTFLoader and
  BufferGeometryUtils from `examples/jsm`. LICENSE kept at `docs/vendor/three/LICENSE`.
- **Pack kit modules are copied, not rewritten** (`docs/js/kit/`). One extension: `sound-kit.js` gained `graph()` so the
  game's extra synth layers (voices, footsteps, ambience, music) share the kit's context, master gain and mute.

## World and progression

- **Two route gates make the world visibly open up.** A sleepy leaf blocks the meadow gate until the leaf slide grows
  ("route toward the pond opens"); the Lantern Rise gate has a splash lamp and a gust lamp that light when the pond and
  the pinwheel are finished, then its leaf doors fold open. Both branch orders reach the dusk friend.
- **Hedges are instanced**, one InstancedMesh per colour family, with capsule colliders along their polylines.
- **The pond and river are terrain, not solids**: walking is refused in water unless an active lotus pad covers the
  spot. The lotus project makes its five kit pads (plus one side pad) walkable, so the crossing is free walking, and
  each pad plays its note when stepped on.
- **Siltbell sits on a small islet in the middle of the pond** (12.2, -4.5), reached only by a side pad that
  rises with the lotus project ("a side pad leads to Siltbell"). Its world.json position (15, 3) would have been
  reachable on foot already. The islet keeps ~0.8 m of water from every shore (checked with the navgrid).
- **Invisible "link" pads between the five lotus pads.** The painted pads overlap only ~0.4 m; a thumb-steered
  child got caught on the narrow necks in testing, so the walkable area between pad centres is ≥ 1 m wide.
- **Foldfern waits beside the slide** (-15.6, 2.4) instead of (-18, 0): its intro is "watches the new leaf slide".
- **The kit's stepping stone at (5,-4) was moved to the dry bank** (2.7,-3.4) — it sat inside the pond and invited
  a step the water rules refuse.
- **Spawn and Tumbletuft keep world.json positions** (spawn -17,10; Tumbletuft near -16,8). The seed is ~3.5 m away so
  the first thing a child does is walk (teaching movement by doing).
- **Time of day follows progress**: afternoon → golden → sunset → dusk (all four toys) → night for the picnic.

- **Moon Picnic seats.** The kit's nine floor sockets are used as-is. The "best seat" is socket 6, the far
  side of the ring from the fixed camera, so the guest of honour faces the child; the Keeper and Tumbletuft sit
  either side. The moon lamp floats above-left of the picnic so no creature's head overlaps it on screen.
- **Finale order** follows the brief: leaf (slide) → ripple lantern (pond) → wind (canopy) → glow lifts the moon
  lamp → friends arrive on short radial routes → Tumbletuft dashes to the best seat, tumbles in ("...I meant to
  do that"), then gives it away. Its line depends on who went first on the slide (the choice returns).
- **After the picnic the island stays at night** (stage 5) for free play; the bell replays the show.
- **Optional friends' incidents** reuse existing verbs: Foldfern takes a slide turn (after you ride once),
  Kitefin challenges you to switch the wind direction and bow, Siltbell needs its pebble lifted and one tap,
  Hushbulb needs you to listen and answer one chime. All untimed.
- **My Friend is limited to befriended slots** so the custom friend is guaranteed to be in the world, the roster
  and the ending. Body/trim colours exclude ink (the eyes are ink).
- **Save code import when storage is blocked** reloads with the code in the URL hash (one boot path, no
  special in-place state rebuild); the hash is removed immediately after reading.

## Feel and presentation

- **Creatures are animated only through the GLB's named nodes** (body/face/ornament/eyes/leaves/fins/feet), never the
  navigation root, so a hop or tumble never moves collision.
- **Variable timestep with sub-steps** (≤ 1/60 s each, ≤ 8 per frame, frame delta clamped at 0.1 s). Smooth on 120 Hz
  displays without interpolation code; a stalled tab cannot launch the Keeper.
- **Action with nothing nearby makes the Keeper wave** (and the follower answer with its quirk) instead of
  doing nothing; the touch button says "Wave". Tumbletuft's quirk sometimes runs ahead, then turns to check
  you are still coming ("looks back").
- **Scripted walks give up** after a generous time limit or when blocked, so no cutscene can hang the game.
- **Portraits are rendered from the real 3D models** into a render target (roster, memory book, friend button), so no
  concept PNG is in the gameplay download.

## Applied skill guidance

(Local read-only reference skills.)

- `disciplines/camera-systems/SKILL.md` — follow uses `1 - exp(-rate·dt)` (rate 5.5) after Keeper movement, plus a tiny
  deadzone so stick micro-movement does not twitch the camera.
- `disciplines/camera-systems/references/follow-and-framing.md` — look-ahead is eased separately (rate 2.2) so direction
  reversals do not whip; cinematic shots blend in and out.
- `disciplines/input-systems/SKILL.md` — keyboard and joystick feed one `move` action; Action/Friend/Mute/Pause are
  edges consumed once; radial deadzone (0.14) rescaled to full speed, magnitude capped at 1.
- `disciplines/input-systems/references/buffering-and-accessibility.md` — floating-origin left-thumb stick routed through
  the same move action; no chords, no precise timing anywhere (all answers are untimed).
- `disciplines/game-feel/SKILL.md` — every milestone uses 2–3 channels (sound + pop + bubble/particles); footsteps are
  much quieter than friendship/project cues.
- `disciplines/game-feel/references/feedback-recipes.md` — restrained overshoot (`easeOutBack`) for leaf growth, gate
  opening and the friendship seed; camera "nudge" is a spring zoom, never random shake, disabled by Calm motion.
- `disciplines/physics-tuning/SKILL.md` — bounded catch-up after stalls (dt clamp 0.1 s, ≤ 8 sub-steps).
- `disciplines/game-ui-ux/references/layout-and-flow.md` — modals take initial focus, trap Tab, restore focus on close;
  touch targets ≥ 48 px (Action 104 px, Friend 72 px, HUD 52 px); state never shown by colour alone (icons + text).
- `disciplines/save-systems/references/versioning-and-migration.md` — integer `schemaVersion`, newer versions rejected
  with a clear message, every ID/number validated before replacing progress, import size capped.
- `disciplines/level-design/SKILL.md` — prerequisites checked for soft-locks with a navgrid BFS (acceptance test 6).
- `disciplines/game-ai/SKILL.md` — explicit FSMs for encounters/projects; follower intent (breadcrumb trail point)
  separated from steering (arrival + separation); no per-frame path recomputation (hint trail every 0.35 s).
- `disciplines/dialogue-systems/SKILL.md` — one-time effects guarded by state (befriend/events are idempotent); barks
  (follow/home lines) kept separate from once-only encounter lines.
- `web-engines/threejs-scene-setup/SKILL.md` — local r180 import map, pixel ratio capped at 1.5, seconds-based delta,
  orthographic bounds recomputed on resize.
- `web-engines/threejs-materials-lighting/SKILL.md` — one hemisphere + one directional light, no shadow maps; lanterns
  use emissive materials + additive halo sprites instead of point lights.
- `web-engines/threejs-gltf-loading/SKILL.md` — GLBs loaded once with GLTFLoader; only the named root is kept; each
  actor clones its materials so recolours and glows stay local.
- `disciplines/performance-optimization/SKILL.md` — instanced decor/hedges/particles; frame-time p50/p95 recorded from
  the real render loop (SwiftShader numbers reported honestly in TEST_REPORT.md).
- `disciplines/audio-design/SKILL.md` — category buses (sfx, voice, ambience, music) under the kit master so mute is
  one switch; repeated sounds are pitch-varied.
- `disciplines/create-game-assets/references/provenance.md` — CREDITS.md records every shipped asset's origin.
