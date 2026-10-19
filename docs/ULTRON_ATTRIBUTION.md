# ULTRON Attribution (MIT)

Reference: https://github.com/SAGAR-TAMANG/ultron-by-sagar-builds
License: MIT (see the upstream repository for the full license text).

## What was studied

- `lib/orbScene.ts` — layered orb scene (wireframe shells, spiral inner core,
  code-text sprites, orbiting debris, dust particles, scan rings), bloom +
  chromatic-aberration post-processing, OrbitControls interaction, rAF loop,
  resize handling, full dispose pattern.
- `lib/handTracker.ts` — MediaPipe HandLandmarker integration, pinch
  hysteresis, one-hand spin / two-hand zoom, mirrored overlay, cleanup.
- `components/JarvisOrb.tsx` — scene + tracker lifecycle glue, gesture
  toggle, keyboard shortcuts, camera error states.

## What was adapted (not copied)

- Scene *architecture* (layered shells → core → particles → rings → glow;
  programmatic rotate/zoom/reset/dispose API) re-implemented as a lightweight
  Canvas 2D engine in `src/lib/dahabOrbScene.ts` — no three.js dependency, no
  amber Iron-Man skin, Living-Chart gold/teal palette, admin-grade particle
  budgets, off-screen pausing.
- Tracker *state machine* (pinch hysteresis, spin/zoom modes, GPU→CPU
  fallback, stop() releasing tracks + landmarker + rAF) re-implemented in
  `src/components/intelligence-core/GestureControl.tsx` as an opt-in lazy
  module (camera OFF by default).
- Lifecycle *patterns* (mount → init → observe → dispose; permission-denied
  and init-failure states that never break the host UI).

No upstream code was pasted verbatim; no proprietary functionality beyond the
open-source interface was reproduced. The visual identity is Dahab's own.
