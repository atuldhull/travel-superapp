# Round BD progress — adversarial pre-device audit + 7 runtime-bug fixes

> Nothing in Phase 4 has rendered on a device yet, so runtime bugs are
> invisible to `tsc`. Round BD ran a multi-agent **adversarial audit**
> of the apps/mobile Aether surfaces to catch those bugs before the
> (operator-owned) EAS build — then fixed every confirmed finding.

## The audit (workflow-driven)

A single Workflow (`round-bd-mobile-audit`) fanned out across 4 review
dimensions, then **adversarially verified** each finding before
surfacing it:

1. **Review** — 4 agents each reviewed a dimension (R3F scenes / Skia
   surfaces / interaction + state / hooks + routes), reading the actual
   files and reporting only runtime concerns `tsc` can't see.
2. **Verify** — each finding spawned a skeptical verifier instructed to
   read the source + the installed library code and default to
   `isReal=false` unless it could point to the exact runtime failure.

21 agents, ~173 tool calls. The verifiers cited real evidence (e.g.
reading `three` r0.168's `Mesh.js` raycast + `Material.js` defaults to
confirm the Lumen culling bug, and correcting a _wrong rationale_ in the
original finding while still confirming the bug). Of the raw findings,
**9 survived verification** (≈ 7 distinct, some dimensions flagged the
same bug) — and all 7 were fixed this round.

## Confirmed findings → fixes

| #     | Severity  | Surface | Bug                                                                                                                             | Fix                                                                                              |
| ----- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| AE570 | misrender | Lumen   | FrontSide planes inside the rotating group cull + stop raycasting for half each rotation — planes blink out + become untappable | `side={DoubleSide}`                                                                              |
| AE571 | logic     | Genie   | a double-tap during the 600ms listening window cancels-and-reschedules the release timer, stalling the FSM in 'Listening…'      | ignore taps while `genieIsActive`; move timers out of the setState updater (read via `stateRef`) |
| AE572 | perf      | Pulse   | breathing rAF called `setNow()` every frame → 60fps full re-render of a permanently-mounted overlay                             | throttle the React commit to ~20fps                                                              |
| AE573 | misrender | Pulse   | `<AetherPulseGlow/>` mounted unconditionally — rendered on every 1.0 route + in production (flag off)                           | flag-gate the mount on `EXPO_PUBLIC_FEATURE_AETHER_PHASE1`                                       |
| AE574 | leak      | Echo    | swipe-hint `setTimeout` untracked — a rapid second swipe's hint gets cleared early by the first's timer; fires after unmount    | track the timer in a ref; clear on new swipe + unmount                                           |
| AE575 | logic     | Mirror  | `now` frozen at mount — the recency fade never advanced, "fades after 60s" was permanently false, no row aged out               | tick `now` every second via `setInterval`                                                        |
| AE576 | logic     | Compass | `useDeviceHeading()` requested location permission even when the route shows the flag-disabled "not enabled" notice             | add an `enabled` param gating the permission + subscription; route passes `AETHER_ENABLED`       |

## Test bar

- `apps/mobile` typecheck: **clean** ✓ (all 7 fixes)
- `@app/aether-canvas-shared` jest: still 745 ✓ (no canvas-shared changes)
- `@app/aether-{core,canvas,audio}-native` jest: still 31 ✓
- web typecheck: untouched + clean

## Why this round mattered

Every bug here is one TypeScript could not see and that would have
surfaced _on a device_ — half of them only intermittently (the Lumen
blink-out, the Genie stall under fast tapping, the Mirror static fade).
Finding them now, by reading the code + the installed library source,
is far cheaper than discovering them mid-EAS-build-debug. The audit also
quantified a real perf problem (the Pulse 60fps overlay) and a real
production leak (Pulse + Compass permission firing when the flag is off)
that would otherwise have shipped silently.

The two deferred items are honestly noted in the commits:

- **Pulse Skia-thread animation** (AE572) — the fully-idiomatic fix
  drives the `<Circle>` from a `useClock` SharedValue, but that needs
  `pulseBreathAt` to be worklet-safe; the ~20fps throttle is the
  low-risk interim. Revisit in the device-tuning pass.
- **Mirror drains after 60s** — correct behaviour for a 60s river; the
  empty state already exists. A future slice could refill the demo feed.

## Operator-owed

- Push the AE570 → AE577 chain (8 commits this round) + the still-
  unpushed AJ-BC history. **~133 unpushed commits total.**
- EAS bootstrap, store accounts, admin-token fallback: still pending.
- **The audit reduces but does not remove the device-validation risk.**
  It caught the bugs visible by reading code; GL-context init, real
  gesture-responder behaviour, and Skia/expo-gl frame timing still need
  a real build to confirm.

## Next round candidates

1. **`useR3FSelection` hook** — DRY the Vault/Atlas/Lumen tap pattern
   (now all audited + consistent) into one reusable hook.
2. **`@app/aether-core-native` consumed** — palette context through the
   AE567 seam; the structural slice.
3. **A second audit pass** focused on the routes + nav + the 1.0
   surfaces the Aether work touched (explore tab, \_layout), or on the
   canvas-shared ↔ scene contract.
4. **EAS bootstrap** (operator) — the gate that turns the now-audited
   stack into something that runs.

## See also

- [`35-round-bc-progress.md`](35-round-bc-progress.md) — Round BC (palette module + Lumen tap)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
