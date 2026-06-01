# Phase 2 closeout — Lumen + Genie + Vault scaffolds

> Status as of 2026-06-01. Phase 2 of the Aether 2.0 plan (see
> [`04-sequencing.md`](04-sequencing.md)) ships **Lumen** (memory studio),
> **Genie** (voice + camera modal), and **Vault** (bookings + commerce)
> as honest scaffolds wired end-to-end through the Phase 1
> infrastructure (lifecycle FSM / palette / audio / Pulse / Continuum).
> The AI and payment backends that live behind these surfaces — Whisper
> STT, CLIP embeddings, ML-Kit detection, Stripe Checkout — land in
> dedicated b-slices once those services are plugged in.
>
> Read this AFTER [`11-phase2-progress.md`](11-phase2-progress.md) (the
> per-surface capability stack) and [`10-phase1-closeout.md`](10-phase1-closeout.md) (the Phase 1 infrastructure Phase 2
> inherits).

## What shipped (AE398 → AE416)

| Slice     | Surface | Headline                                                                 |
| --------- | ------- | ------------------------------------------------------------------------ |
| AE398     | Lumen   | Pure photo-cloud math (`layoutPhotoCloud`, axes, jitter)                 |
| AE399     | Lumen   | R3F scene + shell at `/aether/memory/[id]`                               |
| AE400     | Lumen   | Real memory-book wiring via `useMemoryBookControllerGetOne`              |
| AE401     | Lumen   | Real photo textures (`<PhotoPlane>` + `<LumenPhotoSlot>`)                |
| AE402     | Lumen   | Click-to-zoom + camera dolly + dim/scale of unfocused planes             |
| AE403     | Lumen   | Keyboard nav + sr-only announcer                                         |
| AE404     | Lumen   | `<PhotoPlane>` aspect from texture (override the 0.66 default)           |
| AE405     | Lumen   | Presigned URL TTL refetch (`useUrlTtlRefetch`)                           |
| AE406     | Genie   | Modal state machine scaffold (5 states)                                  |
| AE407     | Vault   | Price-glyph math + 2D placeholder grid + sparkline                       |
| AE408     | docs    | First Phase 2 progress doc                                               |
| **AE409** | Lumen   | Museum arc layout + wheel-pinch focus transitions                        |
| **AE410** | Lumen   | 5 layout strategies (Cloud / Grid / Spiral / Wall / Mood) + arrange menu |
| **AE411** | Genie   | MediaRecorder audio capture + live duration counter                      |
| **AE412** | Genie   | SVG particle dissolution overlay (open swirl + close scatter)            |
| **AE413** | Genie   | Camera mode (live `<video>` feed + tap-to-capture still + mode toggle)   |
| **AE414** | Vault   | R3F floating-glyph ring (sphere ring, per-glyph bob, drop halo)          |
| **AE415** | Vault   | Aether-styled checkout panel (form + simulated submission)               |
| **AE416** | Pulse   | Hold-to-talk gesture opens the Genie modal from every surface            |

## Routes live in dev

- `/aether/memory/<book-id>` — Lumen photo studio
- `/aether/vault` — Vault commerce
- `/aether/drift`, `/aether/atlas`, `/aether/journey/<id>` — Phase 1 surfaces that mount the Genie modal via Pulse hold

All 5 routes return 200 with the flag on (`NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1`).

## Test totals (post AE416)

| Package              | Specs | Net change since Phase 1 closeout (AE397)          |
| -------------------- | ----- | -------------------------------------------------- |
| `@app/aether-core`   | 122   | 0                                                  |
| `@app/aether-canvas` | 77    | +8 (AE404 `aspectFromTexture`)                     |
| `@app/aether-audio`  | 71    | 0                                                  |
| `apps/web`           | 2035  | +353 across +18 spec files (Lumen + Genie + Vault) |

`pnpm --filter web typecheck` clean. 0 new lint errors.

## What's deferred to b-slices

Each Phase 2 slice that depends on a backend or specialised SDK ships
its UI + state machine + form contract today and waits for the live
service to plug in:

- **AE410b** — Lumen mood arrangement via CLIP embeddings (ai-service `/v1/embeddings`). UI ships in AE410 with the `mood` strategy stubbed to the time-cloud.
- **AE411b** — Whisper STT round trip from the recorded blob (ai-service `/v1/transcribe`, behind the optional `pip install .[stt]` extra). MediaRecorder capture ships today.
- **AE412b** — GPU 5000-particle dissolution. SVG 120-particle swarm ships today; the lift happens when the Genie modal moves into the R3F canvas.
- **AE413b** — ML-Kit object detection over the captured still + `/v1/detect-objects` endpoint. Camera capture + the `DETECTION_PLACEHOLDER_LABEL` ship today.
- **AE414b** — drei `<Html>` 3D labels attached to each sphere (current cut keeps the AE407 2D HTML grid layered above the R3F ring).
- **AE415b** — real Stripe Checkout iframe + `STRIPE_PUBLISHABLE_KEY` env + the redirect URL contract. Aether-styled form + simulated payment ship today.

## Operator-owed for Phase 2 promotion

The git tree carries the AE398 → AE416 commit chain locally and not on the remote (the operator-only push policy stands). When promoting Phase 2:

1. Push the AE398 → AE416 commit chain to `origin/main` (classifier blocks; operator only).
2. Flip `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` on prod once the chain lands.
3. When AE411b is ready, `pip install ai-service[stt]` to enable the Whisper extra. Without it the recorder still captures but the transcript stays empty.
4. When AE415b is ready, wire `STRIPE_PUBLISHABLE_KEY` to the prod env. Without it the panel falls back to the simulated submission with the honest "Stripe lands later" footer copy.

## Phase 1 inheritance

Phase 2 reuses every Phase 1 building block intact:

- **Lifecycle FSM** + camera driver + breathing plan (AE375, AE382)
- **Per-surface palette** with `<SurfacePaletteVars/>` CSS-var emission (AE381)
- **Audio bridge** + Tone.js engine + per-surface key signature (AE376, AE380)
- **Pulse** corner glow on every shell (AE389)
- **Continuum** cross-device handoff bar + receiver toast (AE390, AE391)

No Phase 1 surface needed to be re-built. The Lumen / Vault shells reuse the same `<SurfaceManagerProvider>` + `<SurfaceCanvas>` + `<SurfaceAudioLayer>` mount triple, just with their own R3F scene + provider stack on top.

## Where the source of truth lives

- Live surface registry: `apps/web/src/components/aether/phase1/aether-registry.ts` (Lumen + Vault land alongside the 3 Phase 1 surfaces)
- Per-slice pure helpers + paired vitest specs: `apps/web/src/components/aether/phase2/*.ts(x)` + `apps/web/test/lib/*.spec.{ts,tsx}`
- 5 shells: `phase2-lumen-shell.tsx`, `phase2-vault-shell.tsx`, `phase1-{drift,atlas,compass}-shell.tsx` (Genie modal mounted by all 5)
- Surface specs: [`02-surfaces.md`](02-surfaces.md) §4 Lumen, §2 Genie, §7 Pulse, §8 Vault

## See also

- [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 closeout
- [`11-phase2-progress.md`](11-phase2-progress.md) — per-surface capability stack (this doc's longer sibling)
- [`02-surfaces.md`](02-surfaces.md) — the ten surfaces' design specs
- [`04-sequencing.md`](04-sequencing.md) — the six-phase plan
