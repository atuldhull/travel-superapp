# Round AO progress — canvas-shared own behavioural specs

> Round AO adds 5 substantive behavioural spec slices (AE491-AE495)
> for canvas-shared modules that previously had only shape-gate +
> invariant coverage. The web-side specs at `apps/web/test/lib/`
> already pin each helper at the consumer level, but those tests
> won't run in the Phase 4 native package — the goal is to land
> behavioural coverage **inside `@app/aether-canvas-shared`** so the
> native port can re-export from this package and confirm the math
> works without standing up the web suite.

## Slice inventory

| Slice | Title                                                 | File                                                            | Tests |
| ----- | ----------------------------------------------------- | --------------------------------------------------------------- | ----- |
| AE491 | url-ttl behavioural spec                              | `packages/aether-canvas-shared/test/url-ttl.spec.ts`            | +15   |
| AE492 | genie-state FSM spec                                  | `packages/aether-canvas-shared/test/genie-state.spec.ts`        | +26   |
| AE493 | pulse-hold-to-talk gesture spec                       | `packages/aether-canvas-shared/test/pulse-hold-to-talk.spec.ts` | +22   |
| AE494 | lumen-pinch wheel-intent + focus FSM spec             | `packages/aether-canvas-shared/test/lumen-pinch.spec.ts`        | +16   |
| AE495 | vault-checkout title + total + validators + lifecycle | `packages/aether-canvas-shared/test/vault-checkout.spec.ts`     | +30   |
| AE496 | Round AO closeout doc + PROGRESS.md                   | `docs/aether/21-round-ao-progress.md` + README + PROGRESS       | n/a   |

## Test bar

- `pnpm --filter @app/aether-canvas-shared test` (jest):
  - Before AO: **33** passing across 2 specs (shape-gate + invariants)
  - After AO: **142** passing across 7 specs (**+109**)
- web typecheck: unchanged (untouched code)

## What each slice pins

### AE491 — url-ttl

- `msUntilExpiry`: positive/zero/negative ms, NaN for null/undefined/empty/garbage input.
- `refetchDelayMs`: 5-arm transition table — null for invalid/expired, 0 inside margin, `remaining - margin` outside, caller-supplied margin.
- `isExpiryNear`: true at + below margin, true for already-lapsed URLs, false for invalid input.
- `DEFAULT_TTL_REFETCH_MARGIN_MS`: positive integer in the (5s, 2min) tactile range.

### AE492 — genie-state FSM

- `genieStateLabel`: 5-state copy table (idle's "Hold to talk" pinned exactly, every other state matched by regex).
- `genieMicAriaLabel`: action-verb shape + the press-hold / release / retry signal words per state.
- `genieMicRingColor`: idle reads `--aether-palette-accent`, listening + transcribed read `--aether-palette-glow`, processing reads `--aether-palette-support`, error returns a raw hex.
- `genieIsActive`: true only for listening + processing.
- `genieOnMicPress` / `Release` / `Stt` / `Error` / `Reset`: every transition + every no-op branch.
- 3 happy-path traversal scenarios (idle → transcribed; reset; error → retry).

### AE493 — pulse-hold-to-talk

- `PULSE_HOLD_THRESHOLD_MS`: 300..700ms iOS long-press range.
- `isHoldGesture`: above/below default threshold, caller-supplied threshold, non-finite (NaN + Infinity) guards.
- `nextHoldStatus`: 4-status FSM — idle + released sticky, pressing flips to holding at threshold, holding sticky, caller-supplied threshold.
- `pulseReleaseOutcome`: idle = cancel, holding = hold, pressing + duration-aware tap/hold, released passes through duration check.
- `holdStatusLabel`: 4-status aria-live copy (ready / keep-hold / release / opening).
- 2 end-to-end lifecycle traversals (tap path + hold path).

### AE494 — lumen-pinch

- `PINCH_DELTA_THRESHOLD`: positive sub-10px noise floor.
- `wheelToPinchIntent`: ctrlKey=false → null (regular scroll), ctrlKey=true + sign-based intent, sub-threshold collapses to null (5 boundary cases including the exact threshold).
- `nearestPlaneToCenter`: empty list → null, singleton → that plane, multi → geometrically nearest, caller-supplied centre, **first-on-tie ordering** (Phase 4 port can't drift on the focus pick).
- `nextFocusForPinch`: full 6-arm transition table for {null, in, out} × {null, set} focus.

### AE495 — vault-checkout

- `CHECKOUT_NAME_MIN_LENGTH` + `VAULT_CHECKOUT_SIMULATED_DELAY_MS`: bounds.
- `checkoutTitle` + `checkoutTotal`: label echo + minor-amount formatting delegation.
- `checkoutSubmitLabel`: 5-status copy table (idle + open share "Pay with Aether", submitting / success / error each verified).
- `checkoutFooterCopy`: success copy mentions AE415b Stripe handoff; every other status admits the Phase 2 scaffold gap.
- `checkoutStatusLabel`: all 5 statuses non-empty + distinct (no collisions).
- `validateCheckoutName`: trim + min-length + non-string reject.
- `validateCheckoutEmail`: well-formed pass + 6 malformed patterns (missing @ / dot / local / domain, internal whitespace) + trim + non-string reject.
- `canSubmitCheckout`: submitting + success always false; idle/open/error true when form is valid; per-field invalid path.
- `checkoutDisabledReason`: precedence ordering — submitting > success > name > email.

## Why the duplication is the right call

For each module covered, the apps/web spec verifies the SAME logic
from a UI angle (rendered button copy, aria-live announcement,
component state). Those tests are valuable, but they require the
web build pipeline, jsdom, vitest, and a working web tree. They're
how we verify the consumer.

This round's specs run as pure jest in the canvas-shared package
itself. They:

1. Run in <1 second total with no jsdom / no framework / no proxies.
2. Will run unchanged when the Phase 4 mobile package consumes
   `@app/aether-canvas-shared` — the contract is verified at the
   source.
3. Pin precedence orders + tie-break semantics + boundary
   conditions that consumer tests typically gloss over.

## Operator-owed (unchanged from Round AN)

- Push the AE491 → AE495 chain (5 commits this round + the still-
  unpushed AJ-AN history). ~45 unpushed commits total.
- Three Phase 4 decisions still pending (Tamagui-out / R3F-native vs
  Skia / single-binary) + EAS bootstrap before mobile code starts.

## What's left for future rounds in this same lane

24 of the 35 canvas-shared modules still lack a behavioural spec
inside this package. Future rounds can add specs for the bigger
state-modelling files (continuum-state, weather-simulation, lumen-
museum, vault-glyphs sample-prices, genie-recorder, mirror-globe,
echo-feed, etc.) by the same pattern: re-import from `'../src'`,
pin every described branch + edge case + ordering invariant. A
single round of 5-6 slices like AO would cover the rest of the
high-value modules.

## See also

- [`20-round-an-progress.md`](20-round-an-progress.md) — Round AN closeout
- [`18-round-al-progress.md`](18-round-al-progress.md) — canvas-shared completion
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
