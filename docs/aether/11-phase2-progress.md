# Phase 2 progress — Lumen + Genie + Vault scaffolds

> Status as of 2026-06-01. Phase 2 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md)) adds Lumen (memory studio),
> Genie (voice/camera modal), and Vault (bookings + commerce). All three
> ride behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` until Phase 2 earns
> its own env flag.

## What's live

| Surface | Route                 | Scene state                                                                          | Slice IDs   |
| ------- | --------------------- | ------------------------------------------------------------------------------------ | ----------- |
| Lumen   | `/aether/memory/[id]` | R3F photo cloud with real textures, click-to-zoom, keyboard nav, presigned URL cache | AE398-AE405 |
| Genie   | overlay modal         | State-machine modal (idle → listening → processing → transcribed); no STT yet        | AE406       |
| Vault   | `/aether/vault`       | 2D placeholder glyph grid sized by AE407 math; no Stripe yet                         | AE407       |

## Lumen — capability stack

1. **Pure photo cloud math** (AE398) — `LumenPhotoLike` (id / capturedAt / rating / url), `LumenLayoutConfig` (18×8 axes; jitter; plane size), `layoutPhotoCloud` (`timeToX`, `ratingToY`, `jitterZFor`)
2. **R3F scene + shell** (AE399) — `<LumenDataProvider>` + `phase2/lumen-phase2-scene.tsx` (rails + per-photo planes) + `phase2/phase2-lumen-shell.tsx` (Phase 1 chrome inherited)
3. **Real memory book wiring** (AE400) — `useMemoryBookControllerGetOne(bookId)`; assets synthesise capturedAt from `position` until SDK schema adds the real field
4. **Real photo textures** (AE401) — `<PhotoPlane>` primitive in `@app/aether-canvas` + `<LumenPhotoSlot>` per-asset `useMediaControllerDownloadUrl` + pure `extractDownloadUrl` / `extractDownloadExpiresAt`
5. **Click-to-zoom** (AE402) — pure `lumen-selection.ts` (`cameraTargetForPhoto`, `resolveLumenCameraTarget`, `planeOpacityForFocus`, `planeScaleForFocus`); `<LumenSelectionProvider>` + `useLumenSelection()`; per-frame camera lerp via `LumenCameraDriver`; click any plane to focus, Esc to clear
6. **Keyboard nav + aria-live** (AE403) — `arrowDirectionFromKey`, `nextPhotoInDirection` (sort by x for horizontal / by -y for vertical, walk the index), `lumenFocusAnnouncement` (Photo N of M); `<LumenFocusAnnouncer>` sr-only role=status announces focus changes
7. **Texture-aware aspect** (AE404) — pure `aspectFromTexture(texture, fallback)`; PhotoPlane swaps to the real `height / width` once the texture loads
8. **Presigned URL TTL refetch** (AE405) — `msUntilExpiry`, `refetchDelayMs`, `isExpiryNear`; `useUrlTtlRefetch(expiresAt, refetch)` schedules a setTimeout ~30s before expiry; LumenPhotoSlot wires it

## Genie — capability stack (AE406)

Pure state machine `genie-state.ts`:

- 5 states — `idle` / `listening` / `processing` / `transcribed` / `error`
- Per-state helpers — `genieStateLabel`, `genieMicAriaLabel`, `genieMicRingColor`, `genieIsActive`
- Transitions — `genieOnMicPress`, `genieOnMicRelease`, `genieOnStt`, `genieOnError`, `genieReset`

Component `<Phase2GenieModal>`:

- role=dialog + aria-modal backdrop with palette-tinted close × button
- Animated 108px mic button (ring colour + glow vary by state)
- pointerDown / pointerUp / pointerCancel / pointerLeave drive the state machine
- Transcript card appears when state === transcribed
- "Phase 2 preview · STT lands later" footer keeps the honesty visible
- Esc closes; `onStateChange` callback for future Pulse-breath-rate wiring

**Not yet wired** — actual Whisper STT (ai-service `/v1/transcribe`), the particle dissolution, the typeset-in-3D transcript, the camera mode. The Genie trigger from Pulse hold-to-talk also lands later.

## Vault — capability stack (AE407)

Pure `vault-glyphs.ts`:

- `VaultPriceLike {id, label, amountMinor, currency, history?}`
- `glyphSize(amount, min, max, cfg?)` linearly interpolates min..max with clamping + degenerate-range safety
- `glyphOpacity(amount, min, max, cfg?)` ditto for opacity
- `formatMinorAmount(amountMinor, currency)` via `Intl.NumberFormat` with safe fallback
- `priceSparkline(history, cfg?)` returns SVG-ready `{x, y}` points (y inverted so expensive = top)
- `priceDroppedRecently(history)` boolean hint for the soft glow halo

Shell + route:

- `<Phase2VaultShell>` mirrors the Lumen shape (Surface manager + canvas + audio + Pulse + Continuum + dev pip)
- 2D HTML grid overlay renders 4 fixture glyphs sized/weighted via the pure helpers, with SVG sparklines
- `app/aether/vault/page.tsx` Server Component + `vault-lazy.tsx` Client dynamic boundary
- Registered on the surface registry (`phase: 2`, literal `/aether/vault`)

**Not yet wired** — R3F custom shader for glyph physics, Stripe Checkout iframe in the booking flow, real prices from `useStaysControllerSearch` / `useTransportControllerRoutes`.

## Test totals (post AE407)

| Package              | Specs | Net change since Phase 1 closeout (AE397)    |
| -------------------- | ----- | -------------------------------------------- |
| `@app/aether-core`   | 122   | 0                                            |
| `@app/aether-canvas` | 77    | +8 (AE404 `aspectFromTexture`)               |
| `@app/aether-audio`  | 71    | 0                                            |
| `apps/web`           | 1813  | +131 across +9 files (Lumen + Genie + Vault) |

Typecheck clean across packages + apps/web. 0 new lint errors.

## Live routes (dev)

- `/aether/memory/<book-id>` — Lumen with click-to-zoom + keyboard nav + sr-only announcer
- `/aether/vault` — Vault with placeholder glyph grid
- Genie has no route — it mounts as a modal overlay; trigger wiring (hold-to-talk Pulse) lands later

## Pending — Phase 2 finish line

1. **AE409+ Lumen pinch-zoom** for mobile, plus a "museum mode" arrangement when a photo is focused (per 02-surfaces.md §4 — "the rest of the trip's photos arrange themselves in 3D around it like a museum")
2. **AE410+ Lumen CLIP arrange-by-mood** — voice command via Pulse → ai-service `/v1/embeddings` to re-cluster
3. **AE411+ Real Whisper STT** behind Genie — ai-service `/v1/transcribe` (currently stub; real with `pip install .[stt]`) + WebRTC mic stream
4. **AE412+ Genie GPU particle dissolution** + typeset-in-3D transcript
5. **AE413+ Genie camera mode** — ML Kit detection over the live camera feed
6. **AE414+ Vault R3F shader** for floating weighted glyphs + glyph-physics
7. **AE415+ Vault Stripe Checkout** wrapped in Aether material
8. **AE416+ Pulse → Genie wiring** — hold the Pulse glow to open the Genie modal
9. **Phase 2 closeout doc** when all of the above land

## Operator-owed for Phase 2 promotion

- Push the AE398 → AE407 commit chain (classifier blocks; operator only)
- Set `pip install ai-service[stt]` extra and `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` on prod when ready
- Wire a real `STRIPE_PUBLISHABLE_KEY` env when Vault Stripe lands

## See also

- [`02-surfaces.md`](02-surfaces.md) — Lumen §4, Genie §2, Vault §8 specs
- [`04-sequencing.md`](04-sequencing.md) — Phase 2 scope per the roadmap
- [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 inventory + the infrastructure Phase 2 inherits
