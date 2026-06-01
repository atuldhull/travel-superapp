# Phase 2 progress — Lumen + Genie + Vault scaffolds

> Status as of 2026-06-01. Phase 2 of the Aether 2.0 plan
> ([`04-sequencing.md`](04-sequencing.md)) adds Lumen (memory studio),
> Genie (voice/camera modal), and Vault (bookings + commerce). All three
> ride behind `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` until Phase 2 earns
> its own env flag.
>
> **AE409 (2026-06-01)** — Lumen gains museum-mode arrangement +
> wheel-pinch focus transitions. Focus a photo and the rest of the
> cloud rearranges onto a half-circle arc behind the focused plane;
> Ctrl+wheel (trackpad pinch) drives entry / exit of focus.

## What's live

| Surface | Route                 | Scene state                                                                                                          | Slice IDs                |
| ------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Lumen   | `/aether/memory/[id]` | R3F photo cloud, click-to-zoom, keyboard nav, presigned URL cache, museum arc + pinch-in, 5 layout strategies        | AE398-AE405, AE409-AE410 |
| Genie   | overlay modal         | State-machine modal + MediaRecorder capture + camera mode + particle dissolution; STT + ML-Kit detection still later | AE406, AE411-AE413       |
| Vault   | `/aether/vault`       | R3F floating-glyph ring (size by amount, per-glyph bob, drop halo) + 2D label overlay; Stripe still pending          | AE407, AE414             |

## Lumen — capability stack

1. **Pure photo cloud math** (AE398) — `LumenPhotoLike` (id / capturedAt / rating / url), `LumenLayoutConfig` (18×8 axes; jitter; plane size), `layoutPhotoCloud` (`timeToX`, `ratingToY`, `jitterZFor`)
2. **R3F scene + shell** (AE399) — `<LumenDataProvider>` + `phase2/lumen-phase2-scene.tsx` (rails + per-photo planes) + `phase2/phase2-lumen-shell.tsx` (Phase 1 chrome inherited)
3. **Real memory book wiring** (AE400) — `useMemoryBookControllerGetOne(bookId)`; assets synthesise capturedAt from `position` until SDK schema adds the real field
4. **Real photo textures** (AE401) — `<PhotoPlane>` primitive in `@app/aether-canvas` + `<LumenPhotoSlot>` per-asset `useMediaControllerDownloadUrl` + pure `extractDownloadUrl` / `extractDownloadExpiresAt`
5. **Click-to-zoom** (AE402) — pure `lumen-selection.ts` (`cameraTargetForPhoto`, `resolveLumenCameraTarget`, `planeOpacityForFocus`, `planeScaleForFocus`); `<LumenSelectionProvider>` + `useLumenSelection()`; per-frame camera lerp via `LumenCameraDriver`; click any plane to focus, Esc to clear
6. **Keyboard nav + aria-live** (AE403) — `arrowDirectionFromKey`, `nextPhotoInDirection` (sort by x for horizontal / by -y for vertical, walk the index), `lumenFocusAnnouncement` (Photo N of M); `<LumenFocusAnnouncer>` sr-only role=status announces focus changes
7. **Texture-aware aspect** (AE404) — pure `aspectFromTexture(texture, fallback)`; PhotoPlane swaps to the real `height / width` once the texture loads
8. **Presigned URL TTL refetch** (AE405) — `msUntilExpiry`, `refetchDelayMs`, `isExpiryNear`; `useUrlTtlRefetch(expiresAt, refetch)` schedules a setTimeout ~30s before expiry; LumenPhotoSlot wires it
9. **Museum arc + pinch-to-focus** (AE409) — pure `lumen-museum.ts` (`museumArcPositions`, `resolveMuseumTarget`, `DEFAULT_MUSEUM_ARC` w/ radius/span/depth/verticalCompression) re-lays the unfocused planes onto a half-circle around the focused photo; pure `lumen-pinch.ts` (`wheelToPinchIntent`, `nearestPlaneToCenter`, `nextFocusForPinch`) drives focus transitions from Ctrl+wheel / trackpad pinch; `<LumenAnimatedSlot>` wraps `<LumenPhotoSlot>` w/ a per-frame outer-group lerp (speed 4 ≈ 250ms-to-closure)
10. **Layout strategies + arrange menu** (AE410) — pure `lumen-strategies.ts` (`LumenLayoutStrategy` union: `time` / `grid` / `spiral` / `wall` / `mood`; `layoutByGrid` uniform 2D grid; `layoutBySpiral` golden-angle phyllotaxis; `layoutByWall` tighter z-jittered salon arrangement; `layoutByMoodStub` falls back to time-cloud pending CLIP; `applyLayoutStrategy` dispatcher; `isStrategyImplemented` gate for the (AI) label); `<LumenStrategyProvider>` + `useLumenStrategy()`; `<LumenArrangeMenu>` bottom-left palette-tinted pill bar w/ aria-pressed buttons. AE409's animated slot lerps each plane to the new strategy's target on swap — no remounts.

## Genie — capability stack (AE406 + AE411)

Pure state machine `genie-state.ts`:

- 5 states — `idle` / `listening` / `processing` / `transcribed` / `error`
- Per-state helpers — `genieStateLabel`, `genieMicAriaLabel`, `genieMicRingColor`, `genieIsActive`
- Transitions — `genieOnMicPress`, `genieOnMicRelease`, `genieOnStt`, `genieOnError`, `genieReset`

Pure recorder helpers `genie-recorder.ts` (AE411):

- `GenieRecorderStatus` lifecycle union (`idle`/`requesting`/`recording`/`stopping`/`stopped`/`error`)
- `RECORDER_MIME_PREFERENCES` opus-first ordered list (opus webm → webm → mp4 → ogg)
- `pickAudioMimeType(isSupported, prefs?)` returns the first accepted MIME or null
- `formatRecordingDuration(ms)` → `M:SS` (NaN/Infinity/negative all → `0:00`)
- `MAX_RECORDING_MS = 60_000` + `shouldAutoStop(elapsed, max?)` cap helper
- `RECORDER_TICK_MS = 100` (duration counter resolution)
- `recorderStatusLabel(status, durationMs?)` sr-friendly aria-live copy
- `isRecorderBusy(status)` for mic-pulse animation
- `canStartRecording(status)` to gate the mic press

React layer `use-genie-recorder.tsx` (AE411):

- `useGenieRecorder()` wraps `navigator.mediaDevices.getUserMedia({audio: true})` + `MediaRecorder`
- Tracks duration via `window.setInterval` at `RECORDER_TICK_MS`
- Auto-stops at `MAX_RECORDING_MS`
- Releases mic stream on stop / unmount (no leaks)
- Returns `{status, durationMs, mimeType, blob, error, start, stop, reset}`

Component `<Phase2GenieModal>`:

- role=dialog + aria-modal backdrop with palette-tinted close × button
- Animated 108px mic button (ring colour + glow vary by state)
- pointerDown starts capture via `useGenieRecorder()`; pointerUp / Cancel / Leave stop it
- Live `M:SS` duration counter while recording
- Capture summary (`Captured 0:08 · 14 kB · audio/webm;codecs=opus — STT lands later`) on stop
- sr-only `role=status aria-live=polite` announcer pipes `recorderStatusLabel`
- Esc closes (kicks the AE412 dissolve out, then unmounts)
- Transcript card appears when state === transcribed (still stub copy)
- "Phase 2 preview · STT lands later" footer

Particle dissolution overlay (AE412):

- Pure `genie-particles.ts` — `GENIE_PARTICLE_COUNT=120`, `GENIE_DISSOLVE_MS=850`, `particleInitialPosition` (scattered across viewport, deterministic seed), `particleRestPosition` (clustered into a ring in the lower third, angle spread + ±24px radial jitter), `particleRadius` (cubic falloff so most are base, a few are highlights), `particleRestOpacity` (per-particle 0.35-0.80), `easeInOutCubic` (symmetric ease), `particleAt(i, t, w, h)` interpolates between initial / rest with opacity `e * rest`, `canvasDimensions` (safe defaults)
- `<GenieDissolveOverlay>` SVG with N circles driven by `requestAnimationFrame`; `open=true` → swirl in, `open=false` → swirl out + `onClosed?.()` when done
- Mounted inside `<Phase2GenieModal>` z-99 (below the modal chrome z-100); the modal stays mounted through the dissolve-out so the swarm scatters BEFORE the parent unmounts

Camera mode (AE413):

- Pure `genie-camera.ts` — `GenieCaptureMode = 'voice' | 'camera'` union + `GENIE_CAPTURE_MODES` ordered list; `captureModeLabel` / `captureModeGlyph` / `captureModeDescription` for the toggle UI; `GenieCameraStatus` lifecycle (`idle`/`requesting`/`streaming`/`captured`/`error`); `cameraStatusLabel` aria-live copy; `isCameraStreaming` / `canCaptureStill` / `canStartCamera` gates; `formatDetectionLabel(label, confidence)` "Coconut tree (87%)" stub; `DEFAULT_CAMERA_FACING_MODE = 'environment'`; `DEFAULT_CAPTURE_QUALITY = 0.85`; `DETECTION_PLACEHOLDER_LABEL` honest copy
- React `use-genie-camera.tsx` — `useGenieCamera()` wraps `getUserMedia({video: {facingMode: 'environment'}})`, attaches `srcObject` via a `videoRef`, `capture()` draws the current frame to a hidden canvas → JPEG dataURL, releases the stream on stop / unmount; returns `{status, stream, capturedDataUrl, error, videoRef, start, stop, capture, reset}`
- `<Phase2GenieModal>` adds a Voice / Camera pill toggle below the main capture surface; camera mode replaces the mic with a `<video>` feed + a circular capture button; after capture the still freezes and a `Recognising — ML Kit lands later` placeholder appears, click `↺` to retake; sr-only `role=status` mirrors the camera lane
- Mode-aware footer: `Phase 2 preview · STT lands later` (voice) / `Phase 2 preview · ML Kit lands later` (camera)

Genie trigger — Pulse hold-to-talk (AE416):

- Pure `pulse-hold-to-talk.ts` — `PULSE_HOLD_THRESHOLD_MS = 500`; `PulseHoldStatus` union (`idle`/`pressing`/`holding`/`released`); `isHoldGesture(durationMs, threshold?)` cap helper; `nextHoldStatus(current, elapsed, threshold?)` FSM advance; `PulseReleaseOutcome` union (`tap`/`hold`/`cancel`); `pulseReleaseOutcome(status, durationMs, threshold?)` decides what fires on release; `holdStatusLabel` sr-only announcer copy
- React `use-pulse-hold-to-talk.tsx` — `usePulseHoldToTalk({onTap?, onHold?, thresholdMs?})` returns pointer handlers + the live status; sub-threshold tap → `onTap`, > threshold → `onHold`, leave/cancel → no-op; unmount safety clears the pending timeout
- `<Phase1PulseOverlay onHoldOpen?>` — pointer-down/up routed through the hook when `onHoldOpen` is set; soft scale-up + glow ring during the holding state; sr-only `role=status aria-live=polite` line tracks the hold
- All 5 shells (Drift / Atlas / Compass / Lumen / Vault) mount `<Phase2GenieModal>` and pass `onHoldOpen={() => setGenieOpen(true)}` to the Pulse overlay so the Genie modal is one-gesture-away from anywhere
- Modal close path refactored — `requestClose()` fires `onClose?.()` synchronously so the parent flag flips immediately; the AE412 `closing` flag keeps the modal mounted through the dissolve scatter even after the parent unmounts it

**Not yet wired** — the captured audio blob does not yet POST to ai-service `/v1/transcribe`; the captured still does not yet POST to a `/v1/detect-objects` endpoint; typeset-in-3D transcript still later. The full 5000-particle GPU dissolution waits for the genie modal to lift into the R3F canvas (SVG-based 120-particle swarm ships today as the honest first cut).

## Vault — capability stack (AE407 + AE414)

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

R3F scene (AE414):

- Pure `vault-glyph-positions.ts` — `glyphRingPosition(i, total, radius)` lays glyphs on a horizontal XZ ring; `glyphFloatY(i, t, amp?, freq?, phase?)` per-frame vertical bob, phase-shifted per glyph; `glyphSphereScale(amount, min, max, base)` linearly maps amount to `[0.7×base, 1.3×base]` with NaN + degenerate-range safety; `glyphHaloIntensity(dropped, intensity?)` 0 unless `priceDroppedRecently(history)`; defaults: radius 4, amplitude 0.18, frequency 1.4 rad/s, base scale 0.55, phase 0.7
- Shared sample catalogue `vault-sample-prices.ts` — 4 fixture prices + cached `SAMPLE_VAULT_MIN_AMOUNT` / `SAMPLE_VAULT_MAX_AMOUNT` so the R3F scene + the 2D label overlay agree on weighting
- `vault-phase2-scene.tsx` R3F default export — soft ambient + directional light, a thin torus ring backdrop tinted by `palette.support`, then one `<VaultGlyph>` per fixture (sphere geo, `meshStandardMaterial` accent + emissive when dropped, `useFrame` lerps Y via `glyphFloatY` + adds 0.005 rad / frame spin)
- Aether registry adds `mount: () => import('../phase2/vault-phase2-scene')` so SurfaceMountFrame lazy-loads the chunk only when `/aether/vault` is visited

Checkout flow (AE415):

- Pure `vault-checkout.ts` — `VaultCheckoutStatus` lifecycle (`idle`/`open`/`submitting`/`success`/`error`); `checkoutTitle(price)` delegates to `price.label`; `checkoutTotal(price)` reuses AE407 `formatMinorAmount`; `checkoutSubmitLabel(status)` (`Pay with Aether` / `Processing…` / `Booked` / `Try again`); `checkoutFooterCopy(status)` honest about Stripe gap; `checkoutStatusLabel` aria-live announcer; `validateCheckoutName` (≥ 2 chars trimmed), `validateCheckoutEmail` (loose RFC-5322 regex w/ trim), `canSubmitCheckout(status, name, email)` gate; `checkoutDisabledReason` returns sr-only reason copy; `VAULT_CHECKOUT_SIMULATED_DELAY_MS = 1500`; `CHECKOUT_NAME_MIN_LENGTH = 2`
- `<VaultCheckoutPanel>` right-edge slide-in panel: backdrop dim + blur, outside-click closes, Esc closes, palette-tinted form (name + email), Aether-styled Pay button driven by `canSubmitCheckout` + `checkoutDisabledReason`, simulated `setTimeout` round trip writes status `submitting` → `success`, honest footer copy
- Glyph cards in `<Phase2VaultShell>` become `<button>` elements; clicking any glyph sets `selectedPrice` and opens the panel; closing the panel clears the selection

**Not yet wired** — drei `<Html>` to attach labels to each sphere in 3D (current cut keeps the AE407 2D HTML grid layered above the canvas); real Stripe Checkout iframe + `STRIPE_PUBLISHABLE_KEY` + the redirect URL contract (lands in AE415b once the booking target is plugged in); real prices from `useStaysControllerSearch` / `useTransportControllerRoutes`.

## Test totals (post AE407)

| Package              | Specs | Net change since Phase 1 closeout (AE397)                   |
| -------------------- | ----- | ----------------------------------------------------------- |
| `@app/aether-core`   | 122   | 0                                                           |
| `@app/aether-canvas` | 77    | +8 (AE404 `aspectFromTexture`)                              |
| `@app/aether-audio`  | 71    | 0                                                           |
| `apps/web`           | 2035  | +353 across +18 files (Lumen + Genie + Vault + AE409-AE416) |

Typecheck clean across packages + apps/web. 0 new lint errors.

## Live routes (dev)

- `/aether/memory/<book-id>` — Lumen with click-to-zoom + keyboard nav + sr-only announcer
- `/aether/vault` — Vault with placeholder glyph grid
- Genie has no route — it mounts as a modal overlay; trigger wiring (hold-to-talk Pulse) lands later

## Pending — Phase 2 finish line

1. **AE409 — museum arc + wheel-pinch — SHIPPED** (2026-06-01)
2. **AE410 — layout strategies + arrange menu — SHIPPED** (2026-06-01). CLIP backend still pending — the mood strategy stubs to the time-cloud until ai-service `/v1/embeddings` lands.
3. **AE411 — MediaRecorder capture + duration — SHIPPED** (2026-06-01). Pure helpers + `useGenieRecorder()` hook + modal wiring all live; the captured blob still has to round-trip through ai-service `/v1/transcribe` in AE411b once `pip install .[stt]` ships.
4. **AE412 — SVG particle dissolution — SHIPPED** (2026-06-01). 120-particle SVG swirl on open + dissolve on close. Full GPU 5000-particle version + typeset-in-3D transcript still pending.
5. **AE413 — camera-mode scaffold — SHIPPED** (2026-06-01). Live `<video>` feed + still capture via `useGenieCamera()`; ML-Kit detection over the still lands in AE413b once the endpoint ships.
6. **AE414 — Vault R3F floating-glyph ring — SHIPPED** (2026-06-01). Sphere ring + per-glyph bob + drop halo. Custom shader physics + drei `<Html>` labels still later.
7. **AE415 — Aether-styled checkout panel — SHIPPED** (2026-06-01). Right-edge slide-in panel + form + simulated submission. Real Stripe Checkout iframe + redirect URL contract land in AE415b.
8. **AE416 — Pulse hold-to-talk opens Genie — SHIPPED** (2026-06-01). All 5 shells wire it; sub-threshold taps still fall through to the existing AE96 Pulse-open path.
9. **Phase 2 closeout doc** — see [`12-phase2-closeout.md`](12-phase2-closeout.md) when all of the above are stable

## Operator-owed for Phase 2 promotion

- Push the AE398 → AE407 commit chain (classifier blocks; operator only)
- Set `pip install ai-service[stt]` extra and `NEXT_PUBLIC_FEATURE_AETHER_PHASE1=1` on prod when ready
- Wire a real `STRIPE_PUBLISHABLE_KEY` env when Vault Stripe lands

## See also

- [`02-surfaces.md`](02-surfaces.md) — Lumen §4, Genie §2, Vault §8 specs
- [`04-sequencing.md`](04-sequencing.md) — Phase 2 scope per the roadmap
- [`10-phase1-closeout.md`](10-phase1-closeout.md) — Phase 1 inventory + the infrastructure Phase 2 inherits
