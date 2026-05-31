# 04 — Sequencing

> Six phases. Each delivers a usable milestone. Phase 0 only starts after the 1.0 S-series finishes C2 + D1-D5 (live companion + mobile MVP-on-stores) — otherwise the team maintains two frontends during the transition.

## Phase 0 — Foundation (weeks 1-6)

**Goal:** validate the design language with one Surface; everything downstream depends on the choices made here.

- Scaffold `@app/aether/core` + `@app/aether/motion` + `@app/aether/canvas`.
- Define tokens (color, motion, audio, type) in `@app/aether/motion`.
- Storybook + Chromatic wired for the new packages.
- Design DNA explored — one prototype Surface (Drift home) to validate the language. Includes hero animation, palette derivation, audio key signature, particle field.
- Decisions ([see below](#decisions)) answered before code lands.

**Deliverable:** a single prototype Surface (Drift) running on web; can demo to validate the language. Old `apps/web` still serves production traffic.

## Phase 1 — The Trip Loop (weeks 7-18) — **shipped 2026-05-31**

**Goal:** the planning loop is fully Aether-native on web.

| Surface                 | Replaces                     | Status                                                                             |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| **Atlas** (#3)          | `/trips/[id]` and sub-routes | ✅ AE378 + AE384 + AE388 + AE394 + AE395                                           |
| **Drift** (#1)          | `/` home                     | ✅ AE377 + AE385 + AE386 + AE393                                                   |
| **Pulse** (#7)          | always-present AI            | ✅ AE389 + AE392 + AE396                                                           |
| **Compass Bird** (#5)   | desktop navigation, map-pick | ✅ AE379 (basic rose; Mapbox 3D buildings deferred)                                |
| **Continuum bar** (#10) | basic QR handoff             | ✅ AE390 + AE391 (deep-link fallback; WebTransport state-sync deferred to Phase 4) |

Old web routes still serve the rest of the surfaces (memory book, social, etc.). Internal alpha to ~20 users.

Detailed inventory + capability stack in [`10-phase1-closeout.md`](10-phase1-closeout.md).

## Phase 2 — Memory + Voice (weeks 19-28)

**Goal:** the full first-trip-to-memory loop is Aether-native.

| Surface        | Replaces                                                  |
| -------------- | --------------------------------------------------------- |
| **Lumen** (#4) | `/memory-books/[id]` + edit; PDF export (S-B4 ships here) |
| **Genie** (#2) | (new) voice + camera modal                                |
| **Vault** (#8) | `/pricing`, `/account/billing`                            |

Audio layer feature-complete. Procedural palette per-destination feature-complete. Public beta.

## Phase 3 — Social + Live (weeks 29-40)

**Goal:** live trip-watch + social feed land.

| Surface                 | Replaces / Adds            |
| ----------------------- | -------------------------- |
| **Echo** (#6)           | `/feed`, social discovery  |
| **Compass Eye** (#5 AR) | (new) mobile AR navigation |
| **Mirror** (#9)         | `/admin/*` rebuild         |

Live trip-watch (Tier 4 T4-Ag.2) wired. Real public launch.

## Phase 4 — Mobile parity (weeks 41-56)

**Goal:** every Surface ships native-quality on mobile.

- Aether-mobile (`@app/aether/canvas` mobile renderer via Skia).
- Every web Surface rebuilt for mobile (Drift / Atlas / Lumen / Genie / Compass / Echo / Pulse / Vault / Mirror / Continuum).
- Expo build, TestFlight + Play Internal.
- Watch complications + Continuum NFC handoff.

**Deliverable:** mobile launches to app stores.

## Phase 5 — Predictive + Perception (weeks 57-72)

**Goal:** the "feels like magic" tier.

- Predictor MLP trained from accumulated production telemetry.
- Gaze + gesture detection (mediapipe) live.
- Mood mirror live (no user-facing setting; emerges from telemetry).
- Cross-device Continuum full handoff.

## Phase 6 — Polish at AAA (ongoing)

**Goal:** the difference between "good" and "uncopyable."

- Per-destination palettes for top 50 destinations (editorial + auto-derived).
- Per-region motion physics (Tokyo = tight; Berlin = austere; Marrakech = warm + bouncy).
- Sound design pass — every surface's key signature curated by a composer.
- Custom variable-font commissioned for the brand.

---

## Team posture & timeline

Honest ranges:

| Team                    | Phase 4 (mobile launch) | Notes                                                |
| ----------------------- | ----------------------- | ---------------------------------------------------- |
| Solo founder, full-time | 24-30 months            | Each phase ~50% longer due to context-switching.     |
| 3-4 person team         | 14-18 months            | Realistic for a funded seed-stage startup.           |
| 5-7 person team         | 10-12 months            | If hiring goes well + culture survives the velocity. |

### Recommended team (if scaling up)

| Role                      | Time          | Notes                                                       |
| ------------------------- | ------------- | ----------------------------------------------------------- |
| Design lead (motion + 3D) | full-time     | Not a Figma jockey — someone who thinks in physics + light. |
| Staff frontend            | full-time     | Three.js + WebGPU + React internals.                        |
| Senior frontend           | full-time     | Reanimated / Skia / mobile native modules.                  |
| ML-ish engineer           | full-time     | TensorFlow.js + ai-service prompt eng.                      |
| Audio composer            | 6-mo contract | Per-destination key signatures; ambient pads.               |
| Backend (you / existing)  | part-time     | New ai-service work + workers; no new hires needed.         |

### External costs

| Item                            | Cost                                      |
| ------------------------------- | ----------------------------------------- |
| Custom variable font commission | $20-50k                                   |
| Audio composer engagement       | $40-80k                                   |
| ElevenLabs API                  | ~$22/M chars (scales with usage)          |
| WebTransport server             | ~$100/mo on Fly (self-hosted)             |
| Storybook + Chromatic           | $149/mo team tier                         |
| Mapbox (if not self-hosted)     | ~$1-5k/mo at scale                        |
| 3D building data + GTFS feeds   | free → $500/mo for licensed regional data |

---

## Decisions

Eight choices need answers before Phase 0 code lands. They each thread through every subsequent package.

### 1. Aspiration level

Phase 1 in ~4 months (trip-loop Aether) vs Phase 4 in ~14 months (full mobile). Recommendation: **ship Phase 1 publicly** as the v2 launch; Phases 2-4 are post-launch evolution.

### 2. Team posture

Solo / contract designer + composer / hire 2-3 engineers. Recommendation: **2-engineer hire + 6-month composer contract** if budget permits; otherwise solo + composer contract.

### 3. Brand language

Pick one before any palette work starts:

- **Serene Japanese minimal** — restrained, lots of negative space, single accent.
- **Warm Italian tactile** — rich materials, ochre + terracotta, hand-feel.
- **Scandinavian precise** — pale, structured, mathematical.
- **Afrofuturist bold** — saturated, generous typography, kinetic.

The four influence every motion / type / palette decision downstream.

### 4. Audio mandatory vs opt-in

Recommendation: **mandatory-but-respectful-of-mute.** Opt-out-default kills the magic for ~70% of users. But it's a strong opinion; the brand decision.

### 5. Premium gating

Which Surfaces gate behind subscription:

- Genie camera mode (free or premium?)
- Predictor always-on for all users?
- ElevenLabs cloned voice premium-only?
- Compass Eye AR premium-only?

### 6. Web-first vs mobile-first launch

Recommendation: **web-first Phase 1-2, mobile parity Phase 4.** The redesign is so visually unprecedented that a web demo will go viral and drive mobile signups. App-store-first delays virality by 6-12 weeks of review cycles.

### 7. Continuum scope

- Full Continuity (Apple proprietary; iOS only).
- Pan-OS WebTransport (works everywhere; no Lock Screen integration).
- **Both, with clean fallback** — recommended.

### 8. AR commitment

Compass Eye AR mode is impressive but costly. Compass Bird mode covers 90% of users. Defer AR to Phase 5? Recommendation: **yes, defer to Phase 5.**

## See also

- [`00-vision.md`](00-vision.md) — the why.
- [`02-surfaces.md`](02-surfaces.md) — the what.
- [`05-uncopyability.md`](05-uncopyability.md) — the moat.
