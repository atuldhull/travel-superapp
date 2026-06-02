# Round BE progress — Mirror interaction · `useR3FSelection` · palette seam

> Round BE is the **first of the two Phase-4 finish rounds**. It closes
> the remaining _code-authorable_ gaps in the mobile Aether surfaces:
> the last non-interactive surface gets interaction, the three R3F
> tap-scenes are DRY'd onto one hook, and the palette module is hardened
> into a real typed seam. Round BF is the Phase-4 closeout + operator
> handoff.

## What shipped

| #     | Change                                                                                                                                                                                                                                                                                     | Files                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| AE578 | **Mirror tap-to-expand** — tap an audit row to un-truncate its summary + reveal kind / emit-time / event-id; tapping again collapses. Also migrated Mirror's hardcoded hexes onto the `palette.ts` slots (it was missed in the AE567 migration).                                           | `src/aether/mirror-scene.tsx`                                                 |
| AE579 | **`useR3FSelection<T>` hook** — the shared "tap a mesh → lift the datum → render an RN card → close resumes idle drift" state, once. Migrated **Vault**, **Atlas**, **Lumen** onto it.                                                                                                     | `lib/use-r3f-selection.ts` (new) · `src/aether/{vault,atlas,lumen}-scene.tsx` |
| AE580 | **Palette seam hardened** — the five brand colours now live in one `AETHER_PALETTE_SLOTS` object (shape-compatible with the web `SurfacePaletteSlots`); the individual `AETHER_*` consts derive from it, and a pure `resolveAetherPaletteSlots(override)` is the single future swap point. | `src/aether/palette.ts`                                                       |

## Interaction tally: **7/7 → all non-trivial surfaces now interact**

| Surface    | Renderer | Interaction                                          |
| ---------- | -------- | ---------------------------------------------------- |
| Echo       | R3F      | swipe → next memory (PanGesture)                     |
| Vault      | R3F      | tap glyph → checkout panel (`useR3FSelection`)       |
| Genie      | R3F      | tap → listening FSM                                  |
| Compass    | R3F      | real device heading (expo-location)                  |
| Atlas      | R3F      | tap orb → place card (`useR3FSelection`)             |
| Lumen      | R3F      | tap plane → photo card (`useR3FSelection`)           |
| **Mirror** | **Skia** | **tap row → expand detail (AE578 — the closed gap)** |

Pulse + Continuum are ambient-by-design (the breathing glow + the sigil
have no per-element interaction on web either), so 7/7 is the full
interactive set.

## The `useR3FSelection<T>` hook

The three R3F tap-scenes had grown the identical four-line state block by
hand:

```ts
const [selected, setSelected] = useState<T | null>(null);
const onSelect = useCallback((x: T) => setSelected(x), []);
const onClose = useCallback(() => setSelected(null), []);
// ...and `selected?.id ?? null` threaded into the rotating field.
```

`useR3FSelection(getId)` is that block, generic over the datum `T`, with
`getId` supplied by the caller so the hook never assumes a field name.
It returns `{ selected, selectedId, select, close }`:

- `selected` drives the overlay card's mount,
- `selectedId` pauses the idle rotation + highlights the focused mesh,
- `select` is the `onClick` target (after `e.stopPropagation()`),
- `close` clears it (the card's Close button) and the drift resumes.

It holds **no `three`/R3F types** — only `useState`/`useCallback` — so it
respects the framework-free seam rule and would equally serve a Skia
surface wanting lift-to-card behaviour. Vault uses only `selected` (it
has no rotating-field highlight); Atlas + Lumen use `selectedId` too.

## Decision: palette **context** wiring is DEFERRED (with a concrete seam)

Plan item #3 was "consume `@app/aether-core-native`'s palette context
through the `palette.ts` seam." On inspection, the live swap is a
multi-piece _later_ slice, not a palette-internals change — three
independent blockers:

1. `@app/aether-core-native` re-exports the web `@app/aether-core`
   barrel verbatim. Pulling it into the isolated `apps/mobile` workspace
   drags the monorepo's React-19 `@types/react` into the React-18 mobile
   tree → the documented `Type 'ReactNode' … bigint` clash. It is also
   not currently an `apps/mobile` dependency (only `@app/aether-canvas-
shared` + `@app/sdk` are linked).
2. `<SurfacePaletteSlotsProvider>` calls `useSurfacePaletteSlots()`,
   which **requires a `<SurfaceManagerProvider>` ancestor** — mobile
   mounts none.
3. Scenes read these colours as module-level `const`s; a runtime context
   can only be read via a hook inside a component body.

There is no current user-visible benefit (no per-surface palette-override
feature exists on mobile yet), so paying that risk now is the wrong
trade. Instead the seam was made **concrete + typed** so the future swap
is a one-file change:

- `AETHER_PALETTE_SLOTS` — one object, shape-identical to the web
  `SurfacePaletteSlots`; every `AETHER_*` const derives from it (single
  source of truth for a hex).
- `resolveAetherPaletteSlots(override?)` — pure, returns the static lock
  today; the exact function whose body the future slice swaps to coalesce
  `useSurfacePaletteSlotsFromContext() ?? AETHER_PALETTE_SLOTS`.

The 3-step swap recipe is documented in the `palette.ts` header. This is
the plan's sanctioned fallback ("if too risky, keep palette static + note
ctx-swap deferred"), done as a real seam rather than a punt.

## Test bar

- `apps/mobile` typecheck (`tsc --noEmit`): **clean** ✓ — the main mobile
  gate (the package has no test runner). Verified after each change.
- `@app/aether-canvas-shared` jest: **745** ✓ (no canvas-shared changes).
- `@app/aether-{core,canvas,audio}-native` jest: 31 ✓ (untouched).
- web typecheck: untouched + clean.
- **Mobile `pnpm lint` is a pre-existing broken script** — `eslint app
lib` with no `eslint.config.*` ever committed to `apps/mobile` (ESLint 9
  needs a flat config). Every mobile round since AT has gated on typecheck
  alone; logged to operator-owed, not fixed here (out of round scope +
  dependency-lock).

## Operator-owed (carried forward)

- Push the AE578 → AE581 chain + the still-unpushed AJ-BD history.
- **Add an `eslint.config.mjs` to `apps/mobile`** so `pnpm lint` runs (the
  isolated workspace never got a flat config).
- The **palette-context wiring** (the 3 blockers above): add the
  `@app/aether-core-native` dep + install, mount `<SurfaceManagerProvider>`
  - `<SurfacePaletteSlotsProvider>`, flip `resolveAetherPaletteSlots()` to
    a context read. Bundle with whatever slice first needs per-surface
    palette overrides on mobile.
- EAS bootstrap, store accounts, admin-token fallback, the b-slice
  backlog, and on-device validation of every surface — unchanged.

## Next round — BF (the final Phase-4 go)

Comprehensive **Phase 4 closeout doc**: full inventory of all 10 surfaces
(renderer / scene / route / interaction / canvas-shared math), the hooks,
the fixtures, the BD audit findings, and the **operator handoff
checklist** (EAS steps, b-slice backlog, the device-validation list).
Mark Phase 4 **"code-complete pending device build + backend b-slices."**

## See also

- [`36-round-bd-progress.md`](36-round-bd-progress.md) — Round BD (adversarial pre-device audit)
- [`35-round-bc-progress.md`](35-round-bc-progress.md) — Round BC (palette module + Lumen tap)
- [`15-phase4-plan.md`](15-phase4-plan.md) — Phase 4 mobile-parity plan
