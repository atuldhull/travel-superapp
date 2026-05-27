# 03 — Tech stack

> Concrete library choices with versions and rationale. Updated as Phase 0 begins; current selections reflect the May 2026 frontier.

## Rendering

| Library                       | Version | Why                                                                      |
| ----------------------------- | ------- | ------------------------------------------------------------------------ |
| `@react-three/fiber`          | 9.x     | The core 3D layer. Mature, performant, React-native ergonomics.          |
| `@react-three/drei`           | latest  | Utilities — orthographic camera, HTML overlay, asset loaders.            |
| `@react-three/postprocessing` | latest  | Bloom, depth-of-field, chromatic aberration. Used sparingly per surface. |
| `three-stdlib`                | latest  | Loaders, shaders, helpers that don't belong in drei.                     |
| `webgpu` / `@webgpu/types`    | latest  | Native when supported (~90% browsers projected mid-2026).                |
| `@webgpu/webgpu-polyfill`     | latest  | Fallback to WebGL2 when WebGPU absent.                                   |

## Mobile rendering

| Library                               | Version | Why                                                                   |
| ------------------------------------- | ------- | --------------------------------------------------------------------- |
| `@shopify/react-native-skia`          | latest  | Skia exposed to RN; sub-frame GPU rendering. Maintained Shopify fork. |
| `react-native-gesture-handler`        | 2.x     | Gesture choreography.                                                 |
| `react-native-reanimated`             | 3.x     | Worklets on the UI thread; pairs with Skia.                           |
| `expo-three`                          | latest  | Three.js bridge for AR mode on Compass.                               |
| `expo-camera`                         | latest  | Camera-first inputs.                                                  |
| `react-native-vision-camera`          | latest  | Lower-level camera access for AR + ML.                                |
| `vision-camera-mlkit-text-recognizer` | latest  | Menu OCR / sign translation on-device.                                |

## Motion

| Library                 | Version | Why                                                                                           |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `gsap`                  | latest  | Web motion timeline. Commercial license OK; Aether is private.                                |
| `gsap/ScrollTrigger`    | bundled | Scroll-bound motion (Drift parallax).                                                         |
| `gsap/MotionPathPlugin` | bundled | Physics-accurate arcs (Atlas orb drags).                                                      |
| `react-spring/three`    | latest  | R3F element physics; integrates with our motion tokens.                                       |
| `@use-gesture/react`    | latest  | Mid-air gestures (web + mobile bridge).                                                       |
| `cannon-es`             | latest  | Physics for draggable cards in Atlas.                                                         |
| `@motionone/dom`        | latest  | Fallback for surfaces that can't take the GSAP runtime cost (e.g. SSR-only marketing routes). |

## Audio

| Library                 | Version | Why                                                                                          |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `tone`                  | 14.x    | The synth + scheduling engine. Runs in a Web Audio Worklet.                                  |
| `@elevenlabs/streaming` | latest  | Pulse voice — TTS streaming for sub-100ms reply.                                             |
| `expo-av`               | latest  | Mobile playback (the procedural mixer renders to a stream via Web Audio worklet then ports). |

## Perception (on-device ML)

| Library                   | Version | Why                                                                                                  |
| ------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `@mediapipe/face_mesh`    | latest  | Gaze tracking + emotion proxies (web).                                                               |
| `@mediapipe/hands`        | latest  | Mid-air gesture (web).                                                                               |
| `@mediapipe/tasks-vision` | latest  | Unified mobile + web on iOS Safari via WASM.                                                         |
| `@tensorflow/tfjs`        | latest  | Small MLPs (≤500KB) trained offline for the Predictor + Mood Mirror.                                 |
| `@xenova/transformers`    | latest  | On-device CLIP for Lumen auto-arrange (mobile / desktop). Falls back to ai-service `/v1/embeddings`. |

## State + data

| Library                     | Version | Why                                                                                        |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `@tanstack/react-query`     | 5.x     | Already in repo; unchanged.                                                                |
| `zustand`                   | 4.x     | Ephemeral UI state (camera position, motion timeline).                                     |
| `yjs`                       | latest  | CRDT for collaborative Atlas.                                                              |
| `y-webrtc`                  | latest  | Peer-to-peer collaborator sync.                                                            |
| `idb-keyval`                | latest  | IndexedDB fallback when OPFS unavailable.                                                  |
| (browser) Origin Private FS | native  | Predictive cache; full-res photo storage.                                                  |
| (browser) WebTransport      | native  | Cross-device Continuum; admin Mirror stream. Native on Chrome/Firefox; QUIC server on Fly. |

## Layout / typography / theme

| Library                       | Version | Why                                                                                                               |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| CSS Houdini Paint Worklets    | native  | Procedural backgrounds; off the JS thread.                                                                        |
| `@vanilla-extract/css`        | latest  | Compile-time CSS-in-TS with design tokens; no runtime cost.                                                       |
| `react-native-unistyles`      | latest  | Design-token bridge on mobile.                                                                                    |
| Recursive (variable)          | latest  | Open-source variable font; custom axis bindings.                                                                  |
| Inter Variable                | latest  | UI sans, also variable.                                                                                           |
| Roboto Flex                   | latest  | Editorial copy, variable.                                                                                         |
| (commissioned) Aether Display | TBD     | Brand-exclusive variable font, commissioned per [`05-uncopyability.md`](05-uncopyability.md). $20-50k engagement. |

## AI

| Service                            | Why                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| ai-service `/v1/embeddings`        | Ollama-backed (real per S-A1). Used for place + photo + persona embeddings.                      |
| ai-service `/v1/translate`         | Argos-backed (real per S-A2 when extras installed). Genie translation overlay.                   |
| ai-service `/v1/transcribe`        | Whisper-backed (real per S-A3 when extras installed). Genie voice input.                         |
| ai-service `/v1/fake-review/score` | Heuristic today (S-A4); DistilBERT later (Tier 1 T1-AI.4). Echo content moderation.              |
| ai-service `/v1/crowd/predict`     | Heuristic today (S-A5); Prophet later (Tier 1 T1-AI.5). Compass + Atlas crowd-aware suggestions. |
| ElevenLabs Streaming               | Pulse voice. Premium tier offers cloned voice.                                                   |
| (planned) trip-watch loop          | Tier 4 T4-Ag.2; new `trip-watch` BullMQ queue, ai-service or LLM provider depending on tier.     |

## Build + tooling

| Tool                  | Why                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------- |
| Bun (where supported) | Faster package runtime; npm fallback for CI compat.                                 |
| Vite + SWC            | Design-system Storybook bundling.                                                   |
| Turborepo             | Already in repo; Aether packages plug in.                                           |
| `@million/lint`       | React performance linter — flags unnecessary re-renders before they hit the canvas. |
| `webgpu-utils`        | Abstraction over WebGPU pipeline state — tame the API.                              |

## Testing

| Tool                   | Why                                                                         |
| ---------------------- | --------------------------------------------------------------------------- |
| Playwright             | Surface integration tests (≥1 spec per surface).                            |
| Storybook 8            | Component + surface stories; visual regression baseline via Chromatic.      |
| Chromatic              | Already in repo (S-M, M-A11y). Pixel-diff on every PR.                      |
| Jest + happy-dom       | Unit specs on `@app/aether/perception` / `@app/aether/predictor` math.      |
| Vitest                 | Faster TDD loop for Aether's pure-function modules (palette / motion math). |
| `@axe-core/playwright` | Already in repo (S-E7). Every surface must pass WCAG 2 AA.                  |

## Infrastructure additions

| Item                          | Why                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| WebTransport QUIC server      | Continuum + admin Mirror stream. Self-host on Fly with `aiortc` or a Go-based stack. Free.     |
| Mapbox / MapLibre tile server | Compass Bird + Eye modes. Mapbox commercial OR MapLibre OSS + self-hosted OSM tiles ($0 path). |
| ElevenLabs                    | Pulse voice. ~$22/M chars at scale.                                                            |
| GTFS feeds                    | Public transport real-time. Free per-city via `transit.land`.                                  |

## See also

- [`01-architecture.md`](01-architecture.md) — how these libraries compose.
- [`04-sequencing.md`](04-sequencing.md) — when each lands.
- [`05-uncopyability.md`](05-uncopyability.md) — why integration matters more than any single library.
