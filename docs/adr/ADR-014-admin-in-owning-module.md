# ADR-014 — Admin endpoints live in the owning module, not AdminModule

- **Status:** Accepted
- **Date:** 2026-04-26
- **Prompt:** `[IV.18.19.7]` (codifies the pattern shipped across `[IV.18.3.x]`, `[IV.18.11.6]`, `[IV.18.16.5]`, `[IV.18.18.x]`)
- **Playbook reference:** §3.17 (Admin & Ops)

## Context

By the time the admin operator surface had grown to seven verbs across six modules — places curation, JWKS rotation, scam moderation, user moderation, SOS triage, force-purge, trip moderation, media moderation — we had a choice every time a new admin verb landed:

- **A.** Centralise everything in `AdminModule`. Admin controllers + use-cases live in `apps/api/src/modules/admin/`. Cross-module reads go through ports.
- **B.** Each admin verb lives in the OWNING module alongside the regular user-facing verbs. `apps/api/src/modules/media/interface/admin-media.controller.ts` lives next to `media.controller.ts`. Auth posture (`@Roles('admin')`) keeps the surface gated.

We picked **B** for the first three admin verbs and have kept picking it. This ADR ratifies the choice.

## Decision drivers

- **Locality of reasoning.** The admin moderation flow for media reads MediaAsset rows, the admin trip-moderation flow reads Trip rows, etc. Putting the admin verb next to the data it operates on means one engineer reading the module sees the full surface (user + admin) without cross-module hops.
- **Reuse the existing port + adapter.** Admin verbs fit on top of the existing repository pattern by relaxing the owner clause: `findById(id)` instead of `findByIdForOwner(id, userId)`. The pattern is one extra method, not a parallel hierarchy.
- **AdminModule would be a god module.** Nine modules' worth of admin code in one place becomes the largest and least-cohesive module in the project. Bounded contexts ([ADR-004](./ADR-004-bounded-contexts.md)) work because each module owns its data; centralising admin would partially undo that.
- **Auth posture is route-level, not module-level.** `@Roles('admin')` decorates the controller class. Module placement doesn't change the auth gate. So the question is purely "where's this code easier to read + change?" — and the answer is "next to the rest of the module".
- **Cross-module reads stay rare.** Most admin verbs operate on rows in their own module. The few that need cross-module data (e.g. admin user moderation reads from Identity + Trip + Media to render a user's blast radius) get a port in each owning module exposed for admin consumption — same shape we'd use for any other cross-module read.

## Considered options

### A. Centralised AdminModule

- **Shape:** `apps/api/src/modules/admin/{controllers,use-cases,...}/`. Every admin verb lives here. Admin imports each owning module's repository ports.
- **Pros:** one file to grep for "what admin can do".
- **Cons:**
  - Largest module by file count; hardest to grok.
  - Admin moderation logic for media is far from media's domain code; changes split.
  - Cross-module imports concentrate here, making it the most-coupled module in the graph.
  - Newcomers reading `media/` see only half the picture.

### B. Admin in owning module · **CHOSEN**

- **Shape:** `apps/api/src/modules/<context>/interface/admin-<entity>.controller.ts`. Auth via `@Roles('admin')` at the class level. Use-cases co-located in `application/`.
- **Pros:**
  - Locality wins. Reading `media/` shows both the user and admin surfaces.
  - Admin verbs reuse existing ports with relaxed owner clauses — one extra method per port instead of a parallel hierarchy.
  - Bounded-context isolation preserved.
  - "What can admin do?" is a single grep: `@Roles('admin')` across `apps/api/src/modules/`.
- **Cons:**
  - No single file lists every admin verb. The grep is fast (one pattern), but discovery via filesystem-walk is harder.
  - A sibling `AdminModule` still exists — but it owns ONLY genuinely cross-cutting admin work (purge scheduler, JWKS rotation surface). Resist the temptation to drift verbs back into it.

## Decision

**Every admin verb lives in the OWNING module.** The corresponding controller is named `admin-<entity>.controller.ts` (kebab-case, prefix `admin-`). It uses `@Controller('admin/<resource>')` so the URL space stays predictable: `GET /api/v1/admin/media`, `DELETE /api/v1/admin/trips/:id`, etc.

The class-level `@Roles('admin')` decorator is the auth gate. AdminModule retains only genuinely cross-cutting verbs (background purge scheduler, JWKS rotation) — not per-resource moderation.

## Consequences

**Positive:**

- 7 admin verbs across 6 modules, each ~80-120 LOC, sitting next to the user-facing surface. New admin verbs land in ~1-2 files.
- Cross-module imports stay distributed; no god module.
- Reusing the existing repository port (with a relaxed owner clause) means admin verbs don't duplicate query logic.
- Test suites for admin verbs sit next to the user-facing tests, so the same setup helpers (`registerUser`, `loginAsAdmin`) get reused without import gymnastics.

**Negative / open:**

- Discoverability — no one file lists every admin verb. Mitigated by the consistent naming (`admin-*.controller.ts`) and the consistent URL prefix (`admin/`).
- A future "admin SDK" auto-generated from OpenAPI will fan out across modules. Generation is fine; the SDK consumer just sees one namespaced surface.
- The admin trip-moderation verb shipped with archive + delete; admin media moderation shipped with delete only (MediaAsset has no `archived` status; see `[IV.18.18.4]` for the trade-off rationale). Admin verb pairs follow the data-model's actual capabilities — don't shoehorn an archive verb where the schema doesn't support it cleanly.

## Cross-references

- [ADR-004 — Bounded contexts](./ADR-004-bounded-contexts.md) — admin-in-owning-module is the natural extension
- `[IV.18.3.x]` — Admin Places curation (first appearance)
- `[IV.18.11.6]` — Admin scam moderation
- `[IV.18.16.5]` — Admin user moderation
- `[IV.18.18.3]` — Admin trip moderation (archive + delete pair)
- `[IV.18.18.4]` — Admin media moderation (delete only — schema doesn't support archive)
