# Round BA progress — Phase 4 depth begins (real gestures + checkout)

> With all ten surfaces scaffolded (Round AZ), Round BA starts the
> **depth** phase: real interaction. Echo's auto-advance becomes a real
> swipe gesture, and Vault's glyph tap opens a working checkout panel —
> both driven by canvas-shared interaction helpers already spec'd. No
> new surfaces; existing ones get hands.

## Slice inventory

| Slice | Title                                                    | Files                                                     |
| ----- | -------------------------------------------------------- | --------------------------------------------------------- |
| AE559 | Echo real swipe gesture (gesture-handler PanGesture)     | `apps/mobile/src/aether/echo-scene.tsx`                   |
| AE560 | Vault checkout panel (vault-checkout FSM bottom sheet)   | `apps/mobile/src/aether/vault-checkout-panel.tsx`         |
| AE561 | Vault tap-to-checkout wiring (R3F glyph onClick → panel) | `apps/mobile/src/aether/vault-scene.tsx`                  |
| AE562 | Round BA closeout doc + PROGRESS catch-up                | `docs/aether/33-round-ba-progress.md` + README + PROGRESS |

## Test bar

- `apps/mobile` typecheck: **clean** ✓
- `@app/aether-canvas-shared` jest: still 745 ✓ (both interactions reuse
  already-spec'd helpers — echo-feed AE503 + vault-checkout AE495)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## What AE559 added — Echo swipe

Echo's demo auto-advance is replaced by a real
react-native-gesture-handler `PanGesture` feeding the EXACT canvas-shared
swipe pipeline the web pointer handler uses:
`echoSwipeDirectionFromDelta(dx, dy)` → `echoActionForSwipe` →
`nextEchoIndex` (all spec'd AE503).

- Swipe down walks the feed forward (`'next'`); up saves the place;
  left/right rewind / follow-traveller. A transient hint names the
  action; the active card's place + traveller handle show in the
  overlay.
- `activeIndex` lifts to the scene root so the gesture (outside the R3F
  Canvas) drives the stack.
- `Gesture.Pan().runOnJS(true)` runs the `onEnd` callback on the JS
  thread so it calls the React state setter directly — no worklet
  coupling (the reanimated babel plugin is configured regardless).

The root layout's `GestureHandlerRootView` (from V.UX.27) already wraps
the tree, so the gesture works without extra setup.

## What AE560 + AE561 added — Vault checkout

`<VaultCheckoutPanel/>` (AE560) is the native booking panel, mirroring
the web AE415 panel. The SAME pure FSM + validators drive it:
`checkoutTitle` + `checkoutTotal` + `checkoutSubmitLabel` +
`checkoutFooterCopy` + `checkoutStatusLabel` + `canSubmitCheckout`
(wrapping `validateCheckoutName` / `validateCheckoutEmail`) +
`checkoutDisabledReason` (canvas-shared AE415, spec'd AE495).

It's a bottom sheet over a translucent backdrop: title + total +
aria-live status + name/email `TextInput`s + a Pay button gated by
`canSubmitCheckout` (with the disabled-reason hint) + the honest
"Stripe lands later" footer. Submit runs the simulated
`VAULT_CHECKOUT_SIMULATED_DELAY_MS` timeline to `'success'`, then Done
closes it.

AE561 wires it up: each price glyph in the Vault ring gets an R3F
`onClick` (stopPropagation so only the tapped glyph fires) that lifts
the tapped `VaultPriceLike` into scene state + renders the panel over
the Canvas. The full price object threads from the `SAMPLE_VAULT_PRICES`
fixture through each glyph to the panel, so the title + total + currency
come from the tapped entry. **The tap-to-book path is now end-to-end:**
glyph tap → validated form → simulated charge → success.

## Phase 4 depth — what's wired vs what's left

| Surface | Interaction depth                      | Status           |
| ------- | -------------------------------------- | ---------------- |
| Echo    | swipe → walk feed / save / follow      | ✅ AE559         |
| Vault   | tap glyph → checkout panel → book      | ✅ AE560-561     |
| Genie   | tap mic → FSM walk                     | ✅ AE554 (demo)  |
| Compass | self-sweep demo (real heading pending) | ⏳ expo-location |
| Atlas   | tap-to-focus orb + place card          | ⏳               |
| Lumen   | photo textures (Expo Asset)            | ⏳               |
| Mirror  | real admin audit stream                | ⏳ backend       |

Still backend-gated (b-slices): Genie Whisper STT + camera, the
WebTransport feed for Echo + Continuum live sync, the admin audit
stream for Mirror, real Stripe Checkout for Vault.

## Operator-owed

- Push the AE559 → AE562 chain (5 commits this round) + the still-
  unpushed AJ-AZ history. **~118 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **Validate on a device.** The gestures + the R3F glyph picking + the
  checkout sheet all typecheck but none have run — the gesture
  responder + R3F event raycasting on native are the highest-risk
  unverified pieces and need an EAS dev build.

## Next round candidates

1. **Compass real heading** — `expo-location`'s `watchHeadingAsync`
   feeds `<AetherCompassScene headingDegrees={...} />`. Small slice;
   real device sensor.
2. **Atlas tap-to-focus** — R3F orb onClick → focus + a place card
   overlay (mirrors the Vault tap pattern from AE561).
3. **Lumen photo textures** — Expo Asset + `useTexture` so the cloud
   planes show real photos instead of solid tints.
4. **`@app/aether-core-native` consumed** — derive surface mood/lifecycle
   from the manager rather than static props. The structural slice that
   unblocks the audio layer + the lifecycle-driven animation.

## See also

- [`32-round-az-progress.md`](32-round-az-progress.md) — Round AZ (Genie + Mirror; 10/10 breadth complete)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
- [`apps/mobile/src/aether/README.md`](../../apps/mobile/src/aether/README.md) — Aether mobile component folder runbook
