# 01 — Architecture

> Aether is a runtime, not a web app. The web / mobile / admin shells become thin (~500-1000 LOC each) and delegate every surface to the Aether runtime. The runtime is shared via `@app/aether/*` packages.

## Package map

| Package                  | Purpose                                                                  | Approx LOC |
| ------------------------ | ------------------------------------------------------------------------ | ---------- |
| `@app/aether/core`       | Surface manager, route → 3D scene mapping, lifecycle                     | ~3k        |
| `@app/aether/motion`     | Tokens, choreographer, shared timeline, springs                          | ~1.5k      |
| `@app/aether/canvas`     | R3F surface primitives + post-processing pipeline                        | ~4k        |
| `@app/aether/audio`      | Tone.js wrapper, per-surface key signatures, mixer                       | ~1.5k      |
| `@app/aether/perception` | Mediapipe wrappers, mood vector, gesture detector                        | ~2k        |
| `@app/aether/predictor`  | tfjs MLP, training loop, OPFS cache                                      | ~1.5k      |
| `@app/aether/companion`  | Pulse + Genie + voice pipeline                                           | ~3k        |
| `@app/aether/palette`    | k-means on photos, CSS variable bridge, type-rhythm                      | ~1k        |
| `@app/aether/components` | Domain-aware: `<PlaceOrb>`, `<DayTrack>`, `<EchoCard>`, etc. ~40 of them | ~6k        |
| `@app/aether/surfaces`   | The ten surfaces (Drift / Atlas / Lumen / Genie / Compass / etc.)        | ~12k       |
| `@app/aether/continuum`  | WebTransport handoff, QR encoding                                        | ~1k        |
| **Total**                | **~36k LOC**                                                             |            |

Plus a Storybook + Chromatic story per component + per surface for visual regression.

The **web** app becomes ~500 LOC: Next.js shell + Aether boot. The **mobile** app becomes ~1k LOC: Expo shell + Aether-mobile boot + native module bindings. The **admin** app becomes ~200 LOC: a special Aether config that routes only `/mirror/*` surfaces and gates them by role.

## Runtime layers

```text
┌─────────────────────────────────────────────────────────────────┐
│                      AETHER (the runtime)                       │
│                                                                 │
│  Surface (each is a 3D scene)                                   │
│  ├─ Canvas (React Three Fiber + WebGPU when available)          │
│  ├─ FlatLayer (CSS3D / Skia for text-rich overlays)             │
│  └─ AudioLayer (Tone.js — per-scene key signature)              │
│                                                                 │
│  Motion (single shared timeline)                                │
│  ├─ Choreographer (GSAP + Reanimated 3, time-locked)            │
│  ├─ ParticleSystem (R3F instanced meshes, GPU-side)             │
│  └─ ShaderForge (custom GLSL/WGSL for living backgrounds)       │
│                                                                 │
│  Perception (on-device ML)                                      │
│  ├─ GazeTracker (mediapipe face-mesh; web + mobile)             │
│  ├─ GestureReader (mediapipe hands; mid-air gestures)           │
│  ├─ MoodMirror (tap-cadence + scroll-velocity → emotion vector) │
│  └─ Predictor (tfjs MLP that picks next surface)                │
│                                                                 │
│  AI Presence (the always-on entity)                             │
│  ├─ Pulse (the visual: a soft, organic particle blob)           │
│  ├─ Voice (Whisper STT in, ElevenLabs TTS out, streaming)       │
│  └─ Mind (ai-service hooks; persona embedding per user)         │
│                                                                 │
│  State                                                          │
│  ├─ SDK hooks (@app/sdk — React Query, unchanged)               │
│  ├─ Predictive cache (OPFS / IndexedDB; pre-warmed)             │
│  └─ Continuum (cross-device handoff via WebTransport)           │
│                                                                 │
│  Theme (procedural, per-destination)                            │
│  ├─ Palette (k-means on hero photos → 5-color gradient)         │
│  ├─ Motion-physics (per-region gravity / spring constants)      │
│  └─ Type-rhythm (variable-font axis bound to scroll velocity)   │
└─────────────────────────────────────────────────────────────────┘
```

## Rendering layer

- **`@react-three/fiber` 9.x** is the primary 3D layer.
- **`@react-three/drei`** provides utilities (orthographic camera, HTML overlay, controls).
- **`@react-three/postprocessing`** adds bloom, depth-of-field, chromatic aberration — used sparingly; trip-detail destinations get a faint chroma shift toward the destination palette.
- **WebGPU** native when supported (90%+ of browsers projected by mid-2026); falls back to WebGL2 via auto-detection in `@app/aether/canvas`.
- **`react-native-skia`** on mobile for shader-level effects without the Three.js mobile overhead.
- **CSS Houdini Paint Worklets** for procedural backgrounds on web — runs off the JS thread.
- **Web Components (light DOM)** wrap the AI Pulse so it persists across navigation without React tree churn.

## Motion choreography

- **One global timeline.** GSAP on web, Reanimated 3 worklets on mobile, sharing tokens from `@app/aether/motion`.
- **No `transition: all`.** Every motion is choreographed; durations, easings, and delays are tokens (`motion.fast.in`, `motion.heroic.out`).
- **`Skia.Group.transform`** drives all mobile path transforms — GPU-accelerated.
- **Predictive frame** — at 120Hz, render the _next_ frame based on input velocity and reconcile when the real input arrives (Apple-style sub-frame latency).
- **Spring physics everywhere.** No timing curves; everything has mass and friction. Disable for `prefers-reduced-motion`.

Motion tokens map to physical constants per-region (Tokyo = tight springs, low friction; Marrakech = soft, warm overshoot). The token is selected by the surface, not by the component.

## Audio layer

This is the part nobody else has.

- **`Tone.js`** runs in a Web Audio Worklet.
- Each surface has a **key signature**:
  - Tokyo = G♭ minor, dreamy
  - Lisbon = D major, warm
  - Reykjavik = C♯ phrygian, austere
- Every tap plays a note in that key. Random within the scale, weighted by surface tempo.
- Hovering a place orb plays a soft sustain note.
- Errors are not "beep" — they're a deliberately dissonant interval that resolves when the user re-tries.
- Headphones-detected → fuller mix; speakers → cut to single-note clarity.
- **Opt-out is one tap** and the visual still works without sound. Audio is a layer, not a load-bearing channel.

The composition is procedural per-destination but the key signatures are curated by a human composer (see [`05-uncopyability.md`](05-uncopyability.md)).

## Perception (on-device ML)

- **`@mediapipe/face_mesh`** — gaze tracking + emotion proxies (web + iOS Safari via WASM).
- **`@mediapipe/hands`** — mid-air gestures (wave, pinch).
- **`@mediapipe/tasks-vision`** — unified mobile + web build.
- **`react-native-vision-camera`** + **`vision-camera-mlkit-text-recognizer`** — mobile camera-first.
- **`tensorflow.js`** with small MLPs (≤500KB) trained offline — for the Predictor + Mood Mirror.

All ML runs on-device. Nothing about the user's gaze or mood leaves the browser / phone.

## Predictive prefetch

- A small TensorFlow.js MLP (≤500KB) trained on the user's session history.
- Features: current surface, time-on-surface, scroll-velocity, last-3 surface chain.
- Output: probability distribution over next surface.
- Top-2 surfaces preloaded in OPFS / IndexedDB, including their hero photo + first-screen data fetch.
- Target transition time from "click" to "next surface rendered" = **17ms** (one frame at 60Hz, sub-frame at 120Hz).

## Emotional mirror

- **Mood vector** = `(tapCadence, scrollVelocity, dwell, errorCount)` smoothed over a 20-second window.
- High frustration → motion physics get _softer_ (longer easings, gentler springs), background ambient slows, audio reduces density.
- Excited / engaged → motion picks up, palette saturates, audio adds an upper-octave shimmer.
- **No user-facing label.** The user never sees "we think you're stressed." It just feels right.

## Continuum (cross-device)

- **WebTransport** sessions for sub-100ms server-push.
- Active surface + scroll position broadcast to the user's `continuum` channel.
- Switch to another device → "continue where you left off" card → tap → identical surface position, animation continues from there.
- Phone → web handoff via QR (scan with phone) **or** silent on the same Apple ID via Continuity API.

## State layer

- **`@tanstack/react-query` 5.x** — existing repo dep; unchanged.
- **`zustand`** for ephemeral UI state (camera position, motion timeline).
- **`yjs`** for collaborative Atlas (multiple people editing one trip).
- **`OPFS` (Origin Private File System)** — predictive cache, photos at full res.
- **`IndexedDB`** with `idb-keyval` for fallback.
- **`WebTransport`** for cross-device continuum + live admin Mirror stream.

## Theme (procedural, per-destination)

- **Palette** — k-means clustering on the trip's hero photos → 5-color gradient. Bound to CSS variables; every surface re-tints when the trip changes.
- **Motion-physics** — per-region spring constants (region selected from the trip's primary country / culture).
- **Type-rhythm** — variable-font axes (weight, optical size, slant) bound to scroll velocity. Type appears to "lean into" your motion.

## See also

- [`02-surfaces.md`](02-surfaces.md) — what the user sees.
- [`03-tech-stack.md`](03-tech-stack.md) — concrete libraries + versions.
- [`05-uncopyability.md`](05-uncopyability.md) — why this layering matters.
