# ADR-004 — Bounded-context principle: no cross-module imports

- **Status:** Accepted
- **Date:** 2026-04-18
- **Prompt:** `[II.7.1]`
- **Playbook reference:** §7.1

## Context

[ADR-001](./ADR-001-modular-monolith.md) binds us to a modular monolith: the 17 bounded contexts from Playbook §7.2 live side-by-side inside `apps/api/src/modules/<context>/`. A modular monolith is only as good as the discipline that keeps modules from reaching into each other's internals. Left to chance, a TypeScript project with loose imports degrades into a big-ball-of-mud inside a year — at which point the "modular" part of "modular monolith" has quietly evaporated and every future service extraction becomes a rewrite, not a refactor.

The layer rule inside one module (`domain ← application ← infrastructure|interface`) is already binding via ADR-001. This ADR covers the orthogonal question: **how do two modules talk to each other?**

## Decision drivers

- **Extractability.** The whole point of the modular monolith (ADR-001) is that any context can be pulled out into its own service with a mechanical refactor — replace a repository adapter, swap a port implementation. That promise breaks the instant context A starts reaching into context B's internals.
- **Cognitive load.** When Trip can `import { PlacesService } from '../places/...'`, the blast radius of a Places change is the whole product. When Trip can only see `PlacesPort` (an interface), the blast radius is Places itself.
- **Event-driven composition.** §6.4 and [ADR-003](./ADR-003-event-backbone.md) already commit us to events for cross-context fan-out. That commitment is meaningless if direct imports are the path of least resistance.
- **Tool-enforceable.** A rule that lives only in a docs page gets ignored on the first tight deadline. A rule that fails CI gets obeyed by construction.

## Considered options

1. **Free imports, convention-only.** Document the rule, trust reviewers. (Rejected — every project that tries this ends with a ball-of-mud within 12 months.)
2. **Events-only, no facades.** Every cross-context interaction is async via `@app/events`. (Rejected — some reads are inherently synchronous, e.g. "hydrate the place names when returning a trip." Forcing async round-trips for those paths is pointless ceremony.)
3. **Events + explicit facade ports.** Cross-context reads go through a named port; writes and fire-and-forget go through events. Enforce with `import/no-restricted-paths`. (Chosen.)
4. **One-package-per-context.** Turn every module into its own workspace package with TypeScript's `"exports"` field gating visibility. (Rejected for v1 — high refactor cost, and Turborepo boundary-checks give most of the benefit without splitting the monolith into 17 packages before we've shipped.)

## Decision outcome

**Chose option 3 — events + explicit facade ports, enforced by `import/no-restricted-paths`.**

### The rule

A file under `apps/api/src/modules/<A>/**` MAY import:

1. Its own module's internals (`apps/api/src/modules/<A>/**`).
2. Shared packages (`@app/logger`, `@app/config`, `@app/errors`, `@app/events`, `@app/shared-types`, etc.).
3. Another module's **public surface** only — which is explicitly and exclusively:
   - `apps/api/src/modules/<B>/interface/facade/*` — named ports/DTOs the module chooses to expose.
   - Domain events consumed via `@app/events` (not an import from `<B>` at all — the event name is the contract).

A file under `apps/api/src/modules/<A>/**` MUST NOT import:

- `apps/api/src/modules/<B>/domain/**`
- `apps/api/src/modules/<B>/application/**`
- `apps/api/src/modules/<B>/infrastructure/**`
- `apps/api/src/modules/<B>/interface/` (anything other than `interface/facade/`)

Each module's `<A>.module.ts` is the ONLY place a module wires another module in — via NestJS DI, using the facade port as the token.

### The ESLint pattern (ready to paste in `[III.Eslint]`)

This is the exact `import/no-restricted-paths` zone configuration that the shared ESLint config will install. It names every module's private layers as off-limits to its siblings, while leaving the facade carve-out open.

```js
// packages/eslint-config/boundaries.js — to be added by [III.Eslint]
//
// Enforces ADR-004. Every rule is a "from a sibling module, into a private
// layer of this module is forbidden" zone. The facade directory
// (modules/<B>/interface/facade/**) is intentionally NOT listed as a target
// — that is the public surface other modules are allowed to import.
//
// `eslint-plugin-import` resolves `from`/`target` relative to the project
// root. `except` lets a module import its own private layers.

const MODULES = [
  'identity',
  'trip',
  'places',
  'stays',
  'food',
  'transport',
  'safety',
  'weather',
  'events',
  'translation',
  'live',
  'social',
  'media',
  'payments',
  'notifications',
  'analytics',
  'admin',
];

const PRIVATE_LAYERS = ['domain', 'application', 'infrastructure'];

/** @type {import('eslint').Linter.RulesRecord} */
module.exports = {
  'import/no-restricted-paths': [
    'error',
    {
      zones: MODULES.flatMap((target) =>
        PRIVATE_LAYERS.map((layer) => ({
          target: `apps/api/src/modules/${target}/${layer}`,
          from: 'apps/api/src/modules',
          except: [`./${target}/**`],
          message:
            `Cross-context import blocked by ADR-004. ` +
            `Modules may only import a sibling's interface/facade/**. ` +
            `Use a facade port or a domain event — not ${target}/${layer}.`,
        })),
      ).concat(
        // Also block the non-facade parts of interface/ (controllers, DTOs
        // owned by the HTTP edge, etc.) from being reached by siblings.
        MODULES.map((target) => ({
          target: `apps/api/src/modules/${target}/interface`,
          from: 'apps/api/src/modules',
          except: [`./${target}/**`, `./${target}/interface/facade/**`],
          message:
            `Cross-context import blocked by ADR-004. ` +
            `Use ${target}/interface/facade/** or a domain event.`,
        })),
      ),
    },
  ],
};
```

Consumers apply it by spreading `boundaries` into `apps/api`'s ESLint config — no other package needs these rules, because the rule is scoped to `apps/api/src/modules/**`.

### Positive consequences

- A reviewer opening a PR that imports `trip/domain/Trip` from inside `places/` sees a red CI line, not a comment thread.
- Extracting any one context into its own service is mechanical: find its facade ports, reimplement them as HTTP/gRPC clients, swap the binding in the Nest module. No domain code across the rest of the app changes.
- The rule is self-documenting: grepping for `interface/facade/` tells you exactly which types a module is willing to expose.

### Negative consequences

- There's a mild upfront cost per module: the first time you need a sync cross-context read, you must write a facade port in the target module before the calling module can consume it. Acceptable — that's the decision we're paying for.
- `import/no-restricted-paths` operates on literal paths. Path aliases (`@api/modules/...`) must be covered separately if we introduce them — the rule config must be kept in sync with `tsconfig.base.json` path mappings.

## Consequences (binding)

- Every NestJS module under `apps/api/src/modules/<context>/` MUST expose its public surface exclusively at `interface/facade/`. Ports are named `<Name>Port` (interface) with DI tokens in the same file.
- Cross-context **reads** go through a facade port. Cross-context **writes / notifications** go through a domain event (`@app/events`). Direct imports across module boundaries (outside `interface/facade/`) fail CI lint.
- `[III.Eslint]` MUST install the pattern above — unmodified except for the module list, which must track §7.2.
- Adding a new bounded context requires: (a) creating the four-layer directory skeleton, (b) adding the module name to the list in `boundaries.js`, (c) registering the module in the API's root module.
- Any code path that feels it "needs" to bypass this rule for a performance reason MUST first write a superseding ADR explaining why. "It's easier" is not a reason; "the event round-trip is on the p95 hot path and we measured it" is.

## Links

- Playbook §7.1 (Optimum Parts principle).
- Sibling ADRs: [ADR-001](./ADR-001-modular-monolith.md) (layer rule within a module), [ADR-003](./ADR-003-event-backbone.md) (the event bus the "writes go through events" clause relies on).
- [`eslint-plugin-import` `no-restricted-paths` docs](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md).
- Prompt `[III.Eslint]` — installs the rule.
- Prompt `[II.7.2]` — context map that lists each module's events + owned models (complements the facade list this ADR enforces).
