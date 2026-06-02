# Phase 5 plan — Predictive + Perception

> Status as of 2026-06-02. Phase 5 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md), weeks 57-72): "the _feels like
> magic_ tier." This document scopes the work, records the seams the
> architecture **already** has waiting for it, separates the
> authorable-now from the gated, and locks the per-slice order.
>
> **Phase 4 (mobile parity) is code-complete** — see
> [`38-phase4-closeout.md`](38-phase4-closeout.md). Phase 5 begins now,
> but most of it is gated (telemetry, users, devices) — so this round
> ships the one keystone that _is_ authorable: the Predictor foundation.

## Goal

Two capabilities that make the app feel anticipatory:

1. **Predictive** — predict the user's next surface / need and pre-warm
   it, so navigation feels instant. Eventually an MLP trained on
   production telemetry; a heuristic baseline until that data exists.
2. **Perception** — gaze + gesture detection (mediapipe) + a "mood
   mirror" that adapts the surface tone from telemetry, with no
   user-facing setting.

## The architecture already has the sockets (key finding)

Phase 5 is **not green-field** — earlier phases deliberately left seams:

| Seam                                                   | File                                           | What it is                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `anticipating: SurfaceId \| null` + `anticipate(id)`   | `packages/aether-core/src/surface/manager.tsx` | The surface-manager slot the predictor writes its top pick into, to pre-warm the next surface. Commented "Phase 5". |
| `usePerception()` / `PerceptionState` (gaze + gesture) | `packages/aether-core/src/perception.tsx`      | A locked Phase-0 stub returning `active=false`; Phase 5 ships the real mediapipe implementation behind it.          |
| `'predictor-auto'` capability                          | `packages/aether-core/src/premium.tsx`         | The predictor is registered as a premium-gated capability (always-on for premium users).                            |
| `Surface.phase: 1..6`                                  | `packages/aether-core/src/surface/types.ts`    | The surface registry already tags surfaces by phase, so a phase-5 gate filters cleanly.                             |

So the Phase 5 work _fills_ these sockets rather than inventing new
plumbing.

## Authorable-now vs gated

| Item                                                         | Authorable now (off-device, no telemetry)?                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Predictor — heuristic baseline + interface**               | ✅ **fully** — pure logic; ships value immediately + is the MLP's drop-in seam                                          |
| Predictor — MLP                                              | ❌ gated on accumulated production telemetry (needs a live app with traffic)                                            |
| Perception — gaze/gesture input **contract** + mock provider | ✅ partially — the typed contract + a mock; the real mediapipe needs a device + camera                                  |
| Perception — real mediapipe gaze/gesture                     | ❌ gated on native SDK + device + camera permission                                                                     |
| Mood mirror                                                  | ❌ gated on telemetry (it "emerges", no setting)                                                                        |
| Cross-device Continuum full handoff                          | ◐ the sync **protocol/contract** is authorable; the live channel is a backend b-slice (`WT_FEED_URL`/`WT_PRESENCE_URL`) |
| Compass Eye AR                                               | ❌ gated on ARKit/ARCore via Expo + a device (deferred here since Phase 3)                                              |

**Implication:** Phase 5's authorable-now footprint is small (a shell of
contracts + a heuristic) compared to Phase 4's deterministic 10-surface
build — see the 1:1-on-calendar / ~1:5-on-authorable-code split. The
bulk of Phase 5 only unlocks once the app is live and gathering data.

## Slice order (each ~25% of the authorable shell)

1. **Predictor foundation** ✅ (this round, AE583-AE590) — the
   `SurfacePredictor` interface + a pure heuristic baseline that ranks
   the next surface, the feature-vector contract, and the confidence gate
   that decides when to call `anticipate()`. Pure, in
   `@app/aether-canvas-shared`, fully spec'd. **A 27-agent adversarial
   review (review→verify) of the predictor confirmed 17 findings; the 6
   real bugs were fixed (AE590)**: `mirror` was an unreachable candidate
   (no inbound bias) → given an off-hours signal + a CI reachability
   guard; `rankPredictions` broke sum-to-1 on an `Infinity` weight total;
   `tripPhaseFromDayIndex` misclassified an active day when `lastDayIndex`
   was NaN/negative; `actionablePrediction` could return a NaN-scored top
   (now order-independent); the recency penalty double-counted when
   history ended in the current surface; `recencyPenalty` could emit a
   negative/NaN multiplier. Residual (documented, deferred): a
   compile-time lock-step assertion between `PredictableSurfaceId` and
   aether-core's `SurfaceId` — for now a pointer comment in each + the
   reachability guard catch internal drift.
2. **Perception input contract + mock provider** — the typed gaze/gesture
   event stream + a deterministic mock, so consumers can build against it
   before mediapipe lands.
3. **Predictor → surface-manager wiring** — a React hook in
   `@app/aether-core` that builds the feature vector from session state,
   runs the predictor, and feeds `anticipate()`; phase-5 flag-gated.
4. **Continuum sync protocol contract** — the cross-device state-sync
   message shape (the live WebTransport channel stays a backend b-slice).

The MLP, real mediapipe, mood mirror, and Compass Eye AR are **gated**
and tracked as operator/backend/ML work, not authorable rounds.

## Decisions — locked 2026-06-02

| #   | Decision                         | Locked answer                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Where pure predictor logic lives | **`@app/aether-canvas-shared`** — the framework-free package already holds all pure Aether logic (Genie FSM, Vault checkout, Mirror audit). Avoids a new-package `pnpm install` + the React-18/19 `@types` clash. `SurfaceId` is mirrored locally as `PredictableSurfaceId` (the AE526 inline-type pattern). |
| 2   | Heuristic vs model first         | **Heuristic baseline behind the `SurfacePredictor` interface.** The MLP swaps in behind the same interface once telemetry exists — the Phase-4 palette-seam pattern.                                                                                                                                         |
| 3   | What the predictor predicts      | **The next _surface_** (feeds `anticipate(id)`), ranked + normalised, with a confidence gate so we only pre-warm on a clear winner. Not actions/needs yet.                                                                                                                                                   |
| 4   | Feature source                   | **Client-session signals only** (current/recent surfaces, dwell, time-of-day, trip-phase) — no server round-trip; the same vector the MLP will train on.                                                                                                                                                     |
| 5   | Flag                             | **`NEXT_PUBLIC_FEATURE_AETHER_PHASE5` / `EXPO_PUBLIC_FEATURE_AETHER_PHASE5`** (mirrors the PHASE1 pattern). Wired when the predictor→manager consumer lands (slice 3).                                                                                                                                       |

## Timeline (per `04-sequencing.md`)

- Weeks 57-72 (~4 months) on the published plan — **but** the predictive
  - perception tiers are gated on a live app accumulating telemetry and
    on real devices, so the calendar can't start in earnest until Phase 4
    ships from a device. The authorable shell (this slice + the next few)
    is the only part that proceeds locally now.

## See also

- [`38-phase4-closeout.md`](38-phase4-closeout.md) — Phase 4 closeout (the prerequisite)
- [`04-sequencing.md`](04-sequencing.md) — the six-phase plan
- [`01-architecture.md`](01-architecture.md) — the runtime layers + the perception/premium seams
