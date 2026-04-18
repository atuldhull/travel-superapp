# TravelSuperApp — Prompt Archive
### One prompt per Playbook subsection. Designed for Claude Code sessions.

---

## 0 · How to Use This Archive

**Authoritative reference:** [`travel-app-playbook.md`](./travel-app-playbook.md) (or the HTML viewer). Every prompt below cites a Playbook section — read that section before firing the prompt.

**Session hygiene**
- Put **Part 0 — System Rules** (below) into a root `CLAUDE.md`. It loads automatically on every Claude Code session.
- One prompt = one Claude Code session. Start each session by telling Claude which prompt ID is active (e.g. `Running prompt [III.11.1]`).
- For build prompts marked **Mode: Plan-first**, start with `/plan` so Claude drafts before coding.
- When a prompt suggests a subagent (`Explore`, `Plan`, `general-purpose`), invoke it via the `Agent` tool rather than doing the work inline — protects main context.

**Prompt ID convention** — `[Part.Chapter.Subsection]` mirrors the Playbook heading exactly, so you can jump from prompt → Playbook and back.

**Status tracking** — maintain `docs/prompts/status.md` with one row per prompt ID: `TODO / DOING / DONE / BLOCKED`. Use TodoWrite within a session to plan sub-tasks for a single prompt.

**Prompt lifecycle** — see Playbook §24 (Block Lifecycle). Each prompt moves through: PROPOSED → DRAFTED → CODED → TYPECHECKED → UNIT-TESTED → INTEGRATION-TESTED → VERIFIED → SIGNED-OFF.

**Cost discipline** — model-route per Playbook §21.3. Haiku for scaffolding, Sonnet for domain logic, Opus for the hard design calls.

---

## PART 0 · SYSTEM RULES (paste this into root `CLAUDE.md`)

```markdown
# CLAUDE.md — System Rules for TravelSuperApp

## Project
Mobile-first, AI-powered travel super-app. Stack: Turborepo + NestJS 11 + Next.js 15 + React Native (Expo 51) + Prisma 5 / Postgres 16 (PostGIS + pgvector) + Redis 7 + Python FastAPI ai-service. Clean/hex architecture in every NestJS module. Modular monolith with four extracted services (ai, media, notification, crawler).

## Authoritative docs
- `travel-app-playbook.md` — the book. Every decision lives here.
- `travel-app-prompts.md` — prompt archive. You are executing one of these per session.
- `docs/adr/` — architecture decision records (MADR format).
- `docs/blocks/<n>/` — per-prompt artefacts: spec, draft, diff, test-output, verification.

## Hard constraints (never violate)
1. Modify only files in the current prompt's "Files to touch" list.
2. Add only dependencies explicitly listed in the prompt.
3. Never delete a file you did not create in this session.
4. Never commit unless the user says "commit this".
5. Never write secrets / API keys / credentials — use placeholder `REPLACE_ME_SEE_DOPPLER`.
6. Never skip the prompt's Acceptance Criteria check.
7. Never move to the next prompt without user confirmation.
8. Treat `prisma/schema.prisma` as append-only unless the prompt explicitly permits edits.
9. No `any` types. No `console.log` — use `@app/logger`.
10. Clean/hex dependency rule: `domain ← application ← infrastructure/interface`. Never inverted.
11. Never call `prisma.place.create({ data: { coordinates: ... } })` — go through `GeoQueries`.
12. Never store tokens in `localStorage`. Refresh tokens live only in httpOnly cookies.
13. Never wrap network calls inside `prisma.$transaction`.

## Output format (end every session with this block)
```
FILES CREATED: <list>
FILES EDITED:  <list>
DEPS ADDED:    <name@version>
COMMANDS:      <numbered run list>
VERIFICATION:  <paste output>
NEXT PROMPT:   <id> — <one-line context to carry>
```

## Self-check before declaring DONE
- [ ] `pnpm turbo run typecheck` green for touched packages.
- [ ] `pnpm turbo run lint` green for touched packages.
- [ ] Coverage threshold met (domain ≥ 80%, application ≥ 80% on modules).
- [ ] No TODOs left that weren't in the spec.
- [ ] Acceptance criteria verified.

## Escalation (BLOCKED report)
- What I tried.
- What failed (paste the exact error).
- What I need to unblock.
- Do NOT guess or proceed.

## Tool hints (Claude Code)
- Use `/plan` mode before any multi-file build prompt.
- Use `Agent` with subagent `Explore` for codebase research > 3 greps.
- Use `Agent` with subagent `Plan` for architecture-heavy prompts.
- Use `TodoWrite` to track subtasks inside one prompt.
- Use `Skill` (built-ins: `simplify`, `review`, `security-review`, `init`) where appropriate.
- Use prompt caching: put the Prisma schema, shared-types, and error catalog in cache layer 2 (1h TTL).
```

---

## Legend

| Field | Meaning |
|---|---|
| **Ref** | Playbook section |
| **Kind** | `Build` = produces code/files · `Design` = ADR or decision artefact · `Verify` = runs checks against existing code · `Seed` = context-only, no files · `Refactor` = code-moving only |
| **Mode** | `Plan-first` = start with `/plan` · `Execute` = go straight · `Ask` = requires user clarification before either |
| **Subagent** | Optional helper to spawn via the `Agent` tool |
| **Depends on** | Prompts that must be DONE before this one |

---

# PART I — Vision & Strategy

## Chapter 1 — Context & the Problem Space

### [I.1.1] What You're Building
- **Ref** §1.1 · **Kind** Seed · **Mode** Execute · **Depends on** —

```text
Read Playbook §1.1. In 3 lines, give me:
  • the target user persona,
  • the triggering interaction that starts an app session,
  • what the app does during and after the trip.

If any element is ambiguous, STOP and list questions. Do not guess, do not write code, do not create files.
```

**Acceptance:** 3-line pitch produced; no files created; no tech stack mentioned.

### [I.1.2] Target Platforms
- **Ref** §1.2 · **Kind** Seed · **Mode** Execute · **Depends on** [I.1.1]

```text
Per Playbook §1.2, confirm: iOS + Android are primary v1 targets; Next.js web is companion. List every architectural implication this creates (e.g. offline-first on mobile, RSC on web, shared types package, push notification infra, OTA updates). No code.
```

**Acceptance:** ≥ 6 implications listed with the app/package each one will live in.

### [I.1.3] Core Differentiator
- **Ref** §1.3 · **Kind** Seed · **Mode** Execute

```text
Given the differentiator stack (safety + crowd + 3D + live re-plan + scam + agents), rank the six features by moat strength. Moat = hardest for a competitor to copy in 6 months. Return an ordered list with one-sentence justification per item. No code.
```

**Acceptance:** ordered list of 6, each with a defensibility argument.

---

## Chapter 2 — Idea Assessment & Rating

### [I.2.1] Overall Score Internalisation
- **Ref** §2.1 · **Kind** Seed · **Mode** Execute

```text
Internalise: overall rating 8.5/10. Scope is the biggest risk. Confirm you will treat Phase Gates as non-negotiable and will refuse any prompt that expands scope across a phase boundary without explicit user override.
```

**Acceptance:** written acknowledgement stored to `docs/agent-contract.md`.

### [I.2.2] Scorecard Dimensions
- **Ref** §2.2 · **Kind** Design · **Mode** Execute

```text
Turn the 5-dimension scorecard into a `docs/scorecard.md` — one section per dimension, with:
  • current score,
  • 3 leading indicators we'll track post-launch,
  • 1 action that would move this dimension up by ≥ 1 point.
No code elsewhere.
```

**Acceptance:** `docs/scorecard.md` exists with 5 sections.

### [I.2.3] Honest Truths as Constraints
- **Ref** §2.3 · **Kind** Design · **Mode** Execute

```text
Convert the three "honest truths" (timeline, moat, scope) into three durable engineering constraints. Write them to `docs/constraints.md` in this format:
  • Constraint title
  • Trigger (when does this apply)
  • Behaviour required (what we must/must-not do)
  • Enforcement (automated check, PR rule, or human gate)
```

**Acceptance:** file has exactly 3 constraints, each with all four fields.

---

## Chapter 3 — Feature Catalog

### [I.3.1] Pre-Trip Features Inventory
- **Ref** §3.1 · **Kind** Design · **Mode** Execute

```text
Create `docs/features/pre-trip.md`. For each of the 13 pre-trip features in §3.1:
  • one-liner user outcome,
  • owning bounded context (from §7.2),
  • v1/v2/v3 phase assignment per §35,
  • one external dependency (API or model).
Output as a table. No code.
```

**Acceptance:** table has 13 rows, all 4 columns populated.

### [I.3.2] Live Features Inventory
- **Ref** §3.2 · **Kind** Design · **Mode** Execute

```text
Create `docs/features/live.md` with the same structure as [I.3.1] for the 8 live features in §3.2. Extra column: `battery_impact` (low/medium/high) — justify any "high" ratings with the data source the feature polls.
```

**Acceptance:** 8 rows, battery column justified.

### [I.3.3] Post-Trip Features Inventory
- **Ref** §3.3 · **Kind** Design · **Mode** Execute

```text
Create `docs/features/post-trip.md` for the 2 post-trip features. Extra column: `retention_lever` — how this feature pulls the user back for the next trip.
```

**Acceptance:** 2 rows, all columns populated.

### [I.3.4] Missing-Features Backlog (M1–M18)
- **Ref** §3.4 · **Kind** Design · **Mode** Execute

```text
Append the M1–M18 features to the same phased table as [I.3.1–.3]. For each:
  • which existing bounded context absorbs it (do not create new contexts without a strong reason),
  • phase assignment,
  • a rough t-shirt size (S/M/L/XL).
If a feature cannot live in any existing context, flag it for an ADR.
```

**Acceptance:** all 18 items assigned to existing contexts or flagged.

---

## Chapter 4 — Monetization Strategy

### [I.4.1] Affiliate Commissions — Integration Points
- **Ref** §4.1 · **Kind** Design · **Mode** Execute

```text
Define the affiliate integration contract for Booking.com, Amadeus, Viator. Produce `docs/monetization/affiliate.md` covering:
  • outbound deep-link signature (query params we must attach),
  • webhook-in signature for postbacks,
  • commission reconciliation job cadence,
  • chargeback/refund handling policy.
No code. Reference §3.2 for the touch points.
```

**Acceptance:** all 4 sections present; at least one payment edge case (cancellation, partial refund) explicitly handled.

### [I.4.2] Freemium — Paywall Gates
- **Ref** §4.2 · **Kind** Design · **Mode** Execute

```text
Map every Pro-only feature to a specific gate in code: controller + method + guard decorator. Produce `docs/monetization/pro-gates.md` as a table. Don't write the guards yet — that's [III.13.3]. Just the mapping.
```

**Acceptance:** each Pro feature from §4.2 has a concrete gate location.

### [I.4.3] Sponsored Listings — Transparency
- **Ref** §4.3 · **Kind** Design · **Mode** Execute

```text
Specify the "sponsored" visual + API contract. In `docs/monetization/sponsored.md`:
  • API field: `sponsorship.tier` (none|featured|premium) and its effect on ranking,
  • UI rule: badge must be visible without interaction, never hidden behind hover,
  • ad-load cap (max sponsored slots per results page).
```

**Acceptance:** covers API, UI, and inventory cap.

### [I.4.4] B2B Licensing — API Surface Plan
- **Ref** §4.4 · **Kind** Design · **Mode** Execute

```text
List which existing endpoints can be exposed as a B2B API surface for corporate travel + tourism boards. For each, note: extra rate-limit tier, auth mechanism (API key vs OAuth2 client-credentials), data shape differences. Save to `docs/monetization/b2b-api.md`.
```

**Acceptance:** minimum 5 endpoints listed with all three fields.

---

## Chapter 5 — UI/UX Direction

### [I.5.1] Theme System Tokens
- **Ref** §5.1 · **Kind** Build · **Mode** Plan-first · **Subagent** Plan

```text
Plan the design-token schema that supports the four themes (Light, Dark, Sunset, Midnight). Deliver:
  • `packages/ui/src/tokens/theme.ts` — typed token interface (semantic: bg, fg-primary, fg-muted, accent, border, danger, success, etc.),
  • `packages/ui/src/tokens/themes/{light,dark,sunset,midnight}.ts` — concrete values,
  • runtime toggle API (web + mobile via `packages/mobile-ui`).
Tokens must be storage-agnostic; actual persistence (localStorage on web, MMKV on mobile) goes in the app, not the package.
```

**Acceptance:** 4 theme files export a `Theme` object matching the interface exactly; a story in Storybook renders all four.

### [I.5.2] Design Language — Component Primitives
- **Ref** §5.2 · **Kind** Build · **Mode** Plan-first

```text
Define the 12 primitive components referenced by Airbnb/Apple Maps/Hopper patterns: Button, Input, Card, Sheet, Modal, Toast, Avatar, Tag, Badge, Skeleton, Spinner, Icon. For `packages/ui` (shadcn + Tailwind) and `packages/mobile-ui` (Tamagui), produce empty typed scaffolds with propsand default variants — implementation comes per-feature later.
```

**Acceptance:** 12 web + 12 mobile scaffolds; both import the theme tokens from [I.5.1]; no behaviour yet.

### [I.5.3] Animated Map Hero — Contract
- **Ref** §5.3 · **Kind** Design · **Mode** Plan-first

```text
Design the state machine for the animated-map itinerary surface:
  • states: Overview, DayFocus, ItemDetail, Editing, ReplanSuggest,
  • transitions (tap pin, swipe up, drag, long-press),
  • data inputs required per state,
  • events emitted to Analytics (§29).
Save as `docs/ui/map-state-machine.md` + a mermaid diagram.
```

**Acceptance:** mermaid diagram renders; every state has entry/exit events.

### [I.5.4] Onboarding Flow Spec
- **Ref** §5.4 · **Kind** Design · **Mode** Execute

```text
Write `docs/ui/onboarding.md` specifying the 3 onboarding screens, the fields collected, defaults for skip, the analytics events fired (`onboarding_step_viewed`, `onboarding_completed`, `onboarding_skipped`), and the post-onboarding routing decision.
```

**Acceptance:** defaults listed for every field; all analytics events exist in §29.2 or are added.

### [I.5.5] Micro-Interactions Catalogue
- **Ref** §5.5 · **Kind** Design · **Mode** Execute

```text
Catalogue every micro-interaction that requires Reanimated 3, Lottie, or haptics. Table columns: trigger, interaction, library, fallback when reduce-motion is ON (per §5.6). Save to `docs/ui/micro-interactions.md`.
```

**Acceptance:** reduce-motion fallback specified for every row.

### [I.5.6] Accessibility Checklist
- **Ref** §5.6 · **Kind** Verify · **Mode** Execute

```text
Produce `docs/ui/a11y-checklist.md` with rules grouped by: colour contrast (AA), dynamic type, screen reader (VoiceOver + TalkBack), reduce-motion, focus order, touch targets (≥ 44pt). Include the exact ESLint/Storybook plugin names that catch each rule automatically. No code yet.
```

**Acceptance:** every rule has an automation owner (plugin/test/manual).

### [I.5.7] Figma Handoff Protocol
- **Ref** §5.7 · **Kind** Design · **Mode** Execute

```text
Write `docs/ui/figma-handoff.md`: naming conventions for layers, component-to-token mapping, Figma-MCP invocation pattern for Claude Code, export cadence, and the PR template entry that enforces "screenshot attached" for UI changes.
```

**Acceptance:** MCP invocation example included; PR template rule added to `.github/pull_request_template.md` planned (build in [II.10] stage).

---

# PART II — Architecture

## Chapter 6 — System Architecture

### [II.6.1] Architecture Diagram Confirmation
- **Ref** §6.1 · **Kind** Seed · **Mode** Execute

```text
Reproduce the §6.1 diagram from memory. Then trace a single "generate itinerary" request end-to-end: mobile → CDN → gateway → trip module → places port → Prisma/PostGIS → ai-service (RAG) → response → analytics event. List every hop. No code.
```

**Acceptance:** every hop named; no invented services.

### [II.6.2] Modular Monolith Principle — ADR-001
- **Ref** §6.2 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-001-modular-monolith.md` in MADR format. Record: decision (monolith first), context (pre-PMF, <5 engineers), alternatives considered (microservices-first, serverless), consequences (module boundary lint mandatory, extraction triggers defined in §6.3).
```

**Acceptance:** MADR format: Context, Decision Drivers, Considered Options, Decision Outcome (positive + negative), Links.

### [II.6.3] Service Extraction Triggers — ADR-002
- **Ref** §6.3 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-002-service-extraction-triggers.md`. For each of the four services already extracted (ai, media, notification, crawler), document the trigger that justified extraction (language/scale/latency). Then list the 3 triggers that would extract a new service in future.
```

**Acceptance:** all 4 existing extractions have a cited trigger; 3 future triggers listed.

### [II.6.4] Event Backbone — ADR-003
- **Ref** §6.4 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-003-event-backbone.md`. Decision: Redis Streams for v1. Record the exact volume threshold (~50k events/s) at which we migrate to Redpanda, and confirm the adapter pattern in `@app/events` makes this a non-breaking change.
```

**Acceptance:** migration threshold is quantitative; adapter contract sketched.

---

## Chapter 7 — Domain Decomposition

### [II.7.1] Bounded-Context Principle — ADR-004
- **Ref** §7.1 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-004-bounded-contexts.md`. State the cross-context communication rule: only domain events or explicit facade interfaces, never direct service imports across module boundaries. Define the ESLint `import/no-restricted-paths` rule that enforces it; the actual rule file will be written in [III.Eslint] but you specify the pattern here.
```

**Acceptance:** one ESLint rule pattern included, ready to paste.

### [II.7.2] Seventeen Core Contexts — Module Map
- **Ref** §7.2 · **Kind** Design · **Mode** Execute

```text
Create `docs/architecture/context-map.md`. For each of the 17 bounded contexts, list:
  • inbound events consumed,
  • outbound events published,
  • ports exposed (public facade interfaces),
  • owned Prisma models.
If two contexts share a model, stop and raise the conflict — each model has exactly one owner.
```

**Acceptance:** every Prisma model from §12 appears under exactly one owner.

### [II.7.3] Extracted Services — Contracts
- **Ref** §7.3 · **Kind** Design · **Mode** Execute

```text
For each of the 4 extracted services, write `docs/services/<name>/contract.md`:
  • transport (gRPC/REST/queue),
  • endpoint/topic list with request/response schemas in Zod,
  • SLO (latency + availability),
  • failure/degradation mode (per §31.4 patterns).
```

**Acceptance:** 4 contract docs, each with all 4 sections.

### [II.7.4] Shared Packages Manifest
- **Ref** §7.4 · **Kind** Design · **Mode** Execute

```text
Write `docs/packages/manifest.md`. For each cross-cutting package (`@app/logger`, `@app/config`, `@app/auth`, `@app/errors`, `@app/observability`, `@app/events`, `@app/cache`, `@app/ratelimit`, `@app/validation`, `@app/testing`): purpose, public exports, allowed consumers (api, workers, web, mobile, admin, ai-service), forbidden consumers (e.g. `@app/auth` must not be used by `apps/web`).
```

**Acceptance:** every package has an explicit allow-list.

---

## Chapter 8 — Technology Stack

### [II.8.1] Frontend Stack Lock — ADR-005
- **Ref** §8.1 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-005-frontend-stack.md`. Lock Next.js 15 + React Native/Expo 51 + TypeScript strict + shadcn/Tailwind + Tamagui. Record one rejected alternative per choice with reason. No code.
```

**Acceptance:** 5 choices, 5 rejected alternatives.

### [II.8.2] Backend Stack Lock — ADR-006
- **Ref** §8.2 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-006-backend-stack.md`. Lock NestJS 11 + Fastify + Prisma 5 + Python 3.12 FastAPI (ai-service) + BullMQ on Redis. Include rationale and rejected options.
```

**Acceptance:** 5 choices, 5 rejected alternatives.

### [II.8.3] Data Layer Lock — ADR-007
- **Ref** §8.3 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-007-data-layer.md`. Lock Postgres 16 + PostGIS + pgvector + Redis 7 (+Streams +BullMQ) + Meilisearch. Document the "one Postgres for relational + geo + vectors" decision; record the trigger that would split vectors to a dedicated vector DB.
```

**Acceptance:** vector-split trigger is quantitative (embeddings row count + query p95).

### [II.8.4] AI Stack Lock — ADR-008
- **Ref** §8.4 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-008-ai-stack.md`. Document the layered model routing per §21.3 (Haiku/Sonnet/Opus) plus self-hosted NLLB-200, Whisper, DistilBERT, Llama 3.1. Include Anthropic prompt-caching strategy (§21.2). Record fallback chain if Anthropic API is down.
```

**Acceptance:** model per task, cache layers listed, fallback chain covers outage.

### [II.8.5] External APIs Registry
- **Ref** §8.5 · **Kind** Design · **Mode** Execute

```text
Write `docs/external-apis.md` with one row per external provider: name, purpose, base URL, auth type, free-tier limits, cost beyond free, adapter port name, circuit-breaker config.
```

**Acceptance:** every provider from §8.5 present; circuit-breaker policy stated.

### [II.8.6] DevOps & Infra Lock — ADR-009
- **Ref** §8.6 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-009-devops.md`. Lock pnpm + Turborepo + Docker + Fly.io/Railway v1 with Terraform-ready path to AWS ECS/EKS. Record migration triggers to K8s per §34.3.
```

**Acceptance:** K8s migration triggers are quantitative.

---

## Chapter 9 — Clean / Hexagonal Architecture

### [II.9.1] Four-Layer Module Template
- **Ref** §9.1 · **Kind** Build · **Mode** Plan-first

```text
Create `docs/architecture/module-template.md` plus a runnable generator at `tools/create-module.ts` that, given a context name, scaffolds:
  modules/<name>/
    domain/        (index.ts, entity stub, value-object stub, event stub, ports/)
    application/   (index.ts, use-case stub, command/query stub)
    infrastructure/(index.ts, prisma-repo stub, http-client stub)
    interface/     (index.ts, controller stub, dto stub)
    <name>.module.ts (Nest DI wiring)
Include a README per folder clarifying what belongs there.
```

**Acceptance:** `pnpm generate:module foo` produces the tree with compiling placeholders; lint passes.

### [II.9.2] Dependency Rule — ESLint Enforcement
- **Ref** §9.2 · **Kind** Build · **Mode** Execute

```text
Add the `import/no-restricted-paths` rule to `packages/eslint-config/index.js` enforcing: `domain/` cannot import from `application|infrastructure|interface`; `application/` cannot import from `infrastructure|interface`. Cross-module imports forbidden except from other modules' `*.module.ts` (DI) or public `domain/events/*.ts`.
```

**Acceptance:** planting a forbidden import in any module fails `pnpm turbo run lint`.

### [II.9.3] Dependency Rule — Turborepo Boundaries
- **Ref** §9.3 · **Kind** Build · **Mode** Execute

```text
Configure Turborepo task boundaries so packages declare their graph via `dependsOn` correctly. Ensure `@app/config` has zero internal dependencies, `@app/auth` depends on `@app/config` + `@app/errors` only.
```

**Acceptance:** `turbo run build --dry-run` shows expected graph; circular import = build fail.

### [II.9.4] Refactor-Friendliness Assertion
- **Ref** §9.4 · **Kind** Verify · **Mode** Execute

```text
Write a test in `apps/api/test/architecture.spec.ts` that reflects on the module tree and asserts: swapping a Prisma repository for an HTTP client would require changes only in `infrastructure/` — domain and application layers remain untouched. Fail the test if any use-case imports from `@prisma/client` directly.
```

**Acceptance:** test passes for compliant modules, fails for any module with a leaking import.

---

## Chapter 10 — Monorepo Structure

### [II.10.0] Scaffold the Monorepo
- **Ref** §10 · **Kind** Build · **Mode** Plan-first · **Subagent** Plan

```text
Bootstrap the Turborepo monorepo exactly per §10. Use pnpm 9+, Turborepo 2+, Node 22 LTS, TypeScript 5.5+ strict.
Files to touch (new):
  - package.json (root)
  - pnpm-workspace.yaml
  - turbo.json
  - .gitignore, .nvmrc, .npmrc, .editorconfig
  - packages/tsconfig/{base,nestjs,nextjs,react-native}.json
  - packages/eslint-config/{index.js,package.json}
  - .husky/pre-commit, .husky/commit-msg, commitlint.config.js
  - .github/pull_request_template.md
  - README.md
  - CLAUDE.md (Part 0 System Rules verbatim)
Create empty placeholders for every app + package from §10 with minimal package.json so workspaces resolve.
```

**Acceptance:**
- `pnpm install` succeeds.
- `pnpm turbo run lint typecheck` green on empty placeholders.
- Committing with a non-conventional message fails commitlint.
- Husky pre-commit runs lint-staged.

**Notes:** single biggest prompt in Phase 0 — spawn Plan subagent to draft the file tree first.

---

# PART III — Implementation Blueprints

## Chapter 11 — Code Patterns & Conventions

### [III.11.1] Typed Config Package
- **Ref** §11.1 · **Kind** Build · **Mode** Execute · **Depends on** [II.10.0]

```text
Build `packages/config`:
  - src/schema.ts: EnvSchema (Zod) covering every env var from §11.1 plus every placeholder from §8.5 providers.
  - src/validate.ts: validateEnv() throwing with a pretty list of issues.
  - src/nest-config.module.ts: ConfigModule factory binding validated env to NestJS ConfigService.
  - src/index.ts: barrel.
Types: `export type Env = z.infer<typeof EnvSchema>`.
Write tests for: missing required key, invalid URL, successful parse.
```

**Acceptance:** `pnpm --filter=@app/config test` green; NestJS consumer can inject `ConfigService<Env, true>`.

### [III.11.2] Use-Case Pattern Reference
- **Ref** §11.2 · **Kind** Seed · **Mode** Execute

```text
Write `docs/patterns/use-case.md` formalising the use-case contract:
  • one public `execute(cmd)` method,
  • commands are plain DTOs validated with Zod before `execute`,
  • returns a DTO, never an entity,
  • publishes domain events to EventBus after successful persistence,
  • no try/catch around expected domain errors (bubble to global filter).
Include the §11.2 example verbatim.
```

**Acceptance:** doc references Playbook and is linked from the module template README.

### [III.11.3] Auth Guards + RBAC Scaffolding
- **Ref** §11.3 · **Kind** Build · **Mode** Plan-first

```text
Scaffold in `apps/api/src/common/`:
  - guards/jwt-auth.guard.ts — Passport JWT, reads from Authorization header, loads user from Redis cache then DB.
  - guards/roles.guard.ts — CASL-based policy evaluation; @Roles() decorator metadata.
  - decorators/roles.decorator.ts
  - decorators/current-user.decorator.ts
  - decorators/public.decorator.ts
Integrate into a sample TripController to prove the chain. Roles enum: user, premium, agent, admin.
```

**Acceptance:** hitting a `@Roles('premium')` endpoint with a `user` token returns 403 via the DomainError → HTTP filter from [III.15.1].

### [III.11.4] Rate Limiting — Redis Sliding Window
- **Ref** §11.4 · **Kind** Build · **Mode** Execute

```text
Implement a custom ThrottlerStorage backed by Redis sliding window (ZADD/ZREMRANGEBYSCORE). Support per-IP, per-user, and per-endpoint-class buckets. Register with `@nestjs/throttler`. Expose `@Throttle({ ai: { limit: 10, ttl: 60_000 } })` helper that maps to an `ai` bucket.
```

**Acceptance:** integration test proves the 11th call within the window returns `RateLimitError`.

### [III.11.5] Domain Exception Filter
- **Ref** §11.5 · **Kind** Build · **Mode** Execute · **Depends on** [III.11.1]

```text
Build `apps/api/src/common/filters/`:
  - domain-exception.filter.ts — maps DomainError subclasses to `{ code, message, traceId, details, timestamp }`.
  - all-exception.filter.ts — fallback for unhandled errors; logs at ERROR level; never leaks stack in prod.
Wire as global filters in `main.ts`.
```

**Acceptance:** throwing a `NotFoundError` from a controller yields `{ code: "NOT_FOUND", ... }` with HTTP 404 and a trace id.

### [III.11.6] Structured Logger — Pino + Trace Context
- **Ref** §11.6 · **Kind** Build · **Mode** Execute

```text
Build `packages/logger`:
  - src/logger.ts: pino wrapper with redact list from §15.2,
  - src/trace-context.ts: AsyncLocalStorage with { traceId, userId, requestId },
  - src/nest-logger.service.ts: NestJS LoggerService impl,
  - src/http-middleware.ts: pino-http middleware that seeds trace context.
Register in `apps/api` and replace all `console.*` with logger.
```

**Acceptance:** logs emit JSON with `traceId` on every line; `email` and `authorization` never appear in output; integration test with a seeded trace proves correlation.

### [III.11.7] Extensibility Principles — Enforcement
- **Ref** §11.7 · **Kind** Build · **Mode** Execute

```text
Implement:
  1. `@FeatureFlag(flagName)` decorator calling OpenFeature → PostHog provider.
  2. `SettingsService` reading hot-reloadable config (scoring weights, LLM prompts) from Postgres with Redis pub/sub invalidation.
  3. `PlacesProviderRegistry` strategy pattern: `register(name, adapter)` + `get(name)`.
  4. Versioned route prefix `/v1/` enforced in `main.ts`.
  5. `@Deprecated({ sunset: Date })` decorator that emits `Deprecation` header.
```

**Acceptance:** each capability has one unit test proving its behaviour.

---

## Chapter 12 — Data Modeling

### [III.12.1] Prisma Schema Foundation
- **Ref** §12.1 · **Kind** Build · **Mode** Plan-first · **Subagent** Plan

```text
Author `apps/api/prisma/schema.prisma` covering every model implied by §7.2 context map. Use cuid ids, `createdAt`/`updatedAt`, correct relations. Geography columns stay as `Unsupported("geography(Point, 4326)")`, vector columns as `Unsupported("vector(1024)")`. Generate and commit the initial migration `init`.
```

**Acceptance:**
- `pnpm prisma validate` green.
- `pnpm prisma migrate dev --name init` applies cleanly.
- Every model from the context map exists exactly once.

### [III.12.2] PostGIS Raw-SQL Wrapper — GeoQueries
- **Ref** §12.2 · **Kind** Build · **Mode** Execute · **Depends on** [III.12.1]

```text
Create `apps/api/src/common/db/geo-queries.ts` as an `@Injectable()` with typed methods:
  - insertPlace({name, lat, lng, ...fields})
  - findPlacesWithinRadius({lat, lng, radiusKm, filters}): Place[]
  - updatePlaceCoordinates(id, lat, lng)
All use `$executeRaw` / `$queryRaw` with `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`. Every call returns the Prisma-generated row type for safety.
```

**Acceptance:** unit test inserts 3 places, queries within 5km, gets 2 back; type inference works without casts.

### [III.12.3] pgvector — EmbeddingQueries
- **Ref** §12.3 · **Kind** Build · **Mode** Execute · **Depends on** [III.12.1]

```text
Create `embedding-queries.ts`:
  - upsertEmbedding(placeId, number[])
  - findSimilar(embedding, limit): {placeId, distance}[]
Use `<->` operator. Start with IVFFlat index (lists=100). Document the HNSW switch trigger.
```

**Acceptance:** integration test stores 100 random vectors, finds nearest 5 correctly.

### [III.12.4] Required Indexes Migration
- **Ref** §12.4 · **Kind** Build · **Mode** Execute

```text
Add a Prisma migration `indexes` that creates every `@@index` and `@@unique` listed in §12.4. Also add a GiST index on any geography column and IVFFlat on every vector column.
```

**Acceptance:** `EXPLAIN ANALYZE` on a radius query uses the GiST index; `\di` in psql shows every expected index.

### [III.12.5] Extensions Declaration
- **Ref** §12.5 · **Kind** Build · **Mode** Execute

```text
Enable `postgresqlExtensions` preview feature in the generator block. Declare `extensions = [postgis, postgisTopology, vector, pg_trgm, pgcrypto]`. Run `prisma db execute` to create each `CREATE EXTENSION IF NOT EXISTS` (ordered correctly) in a dedicated migration `extensions` that precedes `init`.
```

**Acceptance:** fresh DB gets extensions before any table creation; `\dx` shows all 5.

### [III.12.6] Soft-Delete Policy Decision — ADR-010
- **Ref** §12.6 · **Kind** Design · **Mode** Ask

```text
Open an ADR choosing either:
  A. Soft-delete everywhere with a Prisma middleware filter.
  B. Anonymise-on-delete only (GDPR path, see §30.2).
Recommend B for v1 (simpler, GDPR-aligned). If user picks A, draft the middleware interface. No code until user chooses.
```

**Acceptance:** ADR-010 committed with a chosen outcome and an explicit list of affected models.

---

## Chapter 13 — Security

### [III.13.1] Input Validation — Zod Pipe
- **Ref** §13.1 · **Kind** Build · **Mode** Execute

```text
Build `apps/api/src/common/pipes/zod-validation.pipe.ts`. Usage: `@Body(new ZodValidationPipe(CreateTripSchema))`. On failure throw `ValidationError` with `fieldErrors: Record<string, string[]>`. Reject unknown keys (strict parse).
```

**Acceptance:** posting an extra field yields 422 with the offending key surfaced.

### [III.13.2] Authentication — JWT + Refresh + MFA + JWKS
- **Ref** §13.2 · **Kind** Build · **Mode** Plan-first · **Subagent** Plan

```text
Implement the full Identity module's auth surface:
  • argon2id password hashing (timeCost 3, memoryCost 65536).
  • Access JWT 15m, refresh JWT 30d in httpOnly, SameSite=strict, Secure cookie.
  • Rotating refresh: each refresh issues new access+refresh; old session revoked; reuse-detection revokes all user sessions.
  • TOTP MFA (speakeasy) required for premium + agents.
  • OAuth2 (Google, Apple) with auto-verify email.
  • JWKS: `kid` header on every JWT; current+previous key id in Redis; rotate every 90d via cron.
  • Session concurrency cap: 10 active per user; on limit revoke oldest.
  • Device fingerprint binding: hash of (ua + platform + device-id); mismatch on refresh → revoke.
Use Passport strategies. Write integration tests for every branch.
```

**Acceptance:** full auth test suite green, including JWKS rotation and reuse-detection cascade.

### [III.13.3] Authorization — CASL Policies
- **Ref** §13.3 · **Kind** Build · **Mode** Execute · **Depends on** [III.13.2]

```text
Install CASL. Define `Ability` types per role (user, premium, agent, admin). Build `PoliciesGuard` that reads `@CheckPolicy(...)` metadata. Every resource route gains an ownership check (userId match) — unit-test an IDOR attempt returns 403.
```

**Acceptance:** IDOR test passes; admin bypass correctly scoped.

### [III.13.4] Rate Limiting — PII-Safe Keys
- **Ref** §13.4 · **Kind** Build · **Mode** Execute

```text
Ensure rate-limit storage keys are `sha256(email + pepper)` not raw email. Pepper loaded from env `RATE_LIMIT_PEPPER`. Add a regression test reading Redis keys and asserting no `@` character appears.
```

**Acceptance:** Redis inspection in test shows hashed keys only.

### [III.13.5] Password Reset Flow
- **Ref** §13.5 · **Kind** Build · **Mode** Execute · **Depends on** [III.13.2]

```text
Implement:
  • POST /auth/forgot-password — rate-limited 3/hr/email; always returns 200 (prevent enumeration); stores sha256(resetToken) in Redis with 15m TTL.
  • POST /auth/reset-password — consumes token, invalidates it, revokes all sessions, forces MFA re-enrolment? (decide via ADR).
Send reset email via Resend.
```

**Acceptance:** double-consuming a reset token yields 422; timing of forgot-password with existing vs non-existing email differs by < 50ms.

### [III.13.6] Account Enumeration Prevention
- **Ref** §13.6 · **Kind** Verify · **Mode** Execute

```text
Write `apps/api/test/security/account-enumeration.spec.ts`. Assert:
  • register with existing email returns identical response as register with new email (only differs internally via logging).
  • login with unknown email has same latency distribution (within 30ms p95) as login with known-wrong-password.
  • forgot-password always returns 200.
```

**Acceptance:** all three assertions pass.

### [III.13.7] MFA Backup Codes — HMAC
- **Ref** §13.7 · **Kind** Build · **Mode** Execute

```text
Generate 8 backup codes on MFA enablement, each 8 chars from a 32-char alphabet. Store `HMAC-SHA256(code, pepper)` per code. Verify by computing HMAC of submitted code and doing a constant-time compare against the stored set.
```

**Acceptance:** verification is O(1); codes are single-use (deleted on success).

### [III.13.8] CSRF — Double-Submit Token
- **Ref** §13.8 · **Kind** Build · **Mode** Execute

```text
Install `@fastify/csrf-protection`. Require `X-CSRF-Token` on every state-changing route that reads the refresh cookie. Emit CSRF token via `/auth/csrf` GET. Skip for stateless bearer-only endpoints.
```

**Acceptance:** POST without token returns 403; with token + cookie passes.

### [III.13.9] Transport Security — Helmet + CSP + Peer Protections
- **Ref** §13.9 · **Kind** Build · **Mode** Execute

```text
Configure Fastify Helmet for HSTS preload (2-year max-age), strict CSP with per-request nonces injected into Swagger UI, Trusted Types, COOP, COEP, Permissions-Policy denying camera/mic/geo except for explicitly-opted-in routes. mTLS between internal services in prod — issue keys via workload identity (doc only for v1).
```

**Acceptance:** `curl -I` shows all required headers; CSP has nonces not unsafe-inline.

### [III.13.10] Secrets — Doppler + gitleaks
- **Ref** §13.10 · **Kind** Build · **Mode** Execute

```text
Wire Doppler CLI for local dev. Add gitleaks to `security.yml` GitHub Action. Rotate script: document secret rotation cadence in `docs/runbooks/runbook-rotate-secrets.md`.
```

**Acceptance:** committing a fake AWS key fails CI; rotation runbook covers every env var.

### [III.13.11] PII Field Encryption
- **Ref** §13.11 · **Kind** Build · **Mode** Plan-first

```text
Encrypt User.email and User.phone at rest using pgcrypto's `pgp_sym_encrypt` with a key loaded from env. Store SHA-256 emailHash (with pepper) for lookups. Write a Prisma middleware or raw-SQL wrapper that encrypts on write, decrypts on read, never logs plaintext.
```

**Acceptance:** dumping the User table without the key yields ciphertext; tests prove login still works.

### [III.13.12] GDPR/DPDP Compliance Scaffolding
- **Ref** §13.12 · **Kind** Build · **Mode** Plan-first · **Depends on** [VIII.30.2]

```text
Implement the endpoints:
  • GET /users/me/export — see [VIII.30.3] for full spec.
  • DELETE /users/me — triggers the propagation flow from §30.2.
  • /legal/subprocessors — static JSON endpoint from §30.6.
  • /legal/privacy-policy-version — returns current policy version + date.
All endpoints audited in a separate encrypted log.
```

**Acceptance:** export job produces a signed zip; delete flow fires UserDeletedEvent.

### [III.13.13] Container Security
- **Ref** §13.13 · **Kind** Build · **Mode** Execute

```text
Convert Dockerfiles to distroless base. Add Trivy image scan step to `security.yml` failing on HIGH+ vulns. Generate SBOM (CycloneDX) on every image build and upload as workflow artifact.
```

**Acceptance:** CI fails when an intentionally vulnerable base is introduced; SBOM attached to run.

### [III.13.14] OWASP Mobile Top 10 — Hardening
- **Ref** §13.14 · **Kind** Build · **Mode** Plan-first

```text
In apps/mobile:
  • cert pinning via `react-native-ssl-pinning` pointing at API SHA256 fingerprint (loaded from EAS secret).
  • secure storage: tokens in Keychain/Keystore via `expo-secure-store`, never MMKV.
  • jailbreak/root detection via `jail-monkey`; on detection, disable Pro flows and telemetry-flag.
  • biometric gate for payments, agent messaging, and SOS history.
```

**Acceptance:** Maestro test on rooted emulator confirms Pro features are disabled.

---

## Chapter 14 — Testing Strategy

### [III.14.1] Testing Pyramid Scaffolding
- **Ref** §14.1 · **Kind** Build · **Mode** Plan-first

```text
Wire Jest for every package/app; Supertest for API; Testcontainers for Postgres+Redis+Meilisearch in integration tests; Playwright for web E2E; Maestro for mobile; k6 for load; Pact for contract tests. Each tool gets a sample green test.
```

**Acceptance:** `pnpm turbo run test test:integration test:e2e` all green on stub tests.

### [III.14.2] Coverage Thresholds
- **Ref** §14.2 · **Kind** Build · **Mode** Execute

```text
Configure Jest per app to enforce coverage: `domain/` ≥ 80%, `application/` ≥ 80%, global ≥ 60%. Fail CI if thresholds drop. Use `coverageThreshold` with path-glob keys.
```

**Acceptance:** reducing coverage intentionally breaks `ci.yml`.

### [III.14.3] Contract Tests — Pact
- **Ref** §14.3 · **Kind** Build · **Mode** Execute

```text
Set up Pact broker (self-host or hosted free tier). Consumer tests in `apps/web` and `apps/mobile` publish pacts; provider tests in `apps/api` verify them on every PR. Block merge on unverified pacts.
```

**Acceptance:** introducing a breaking API change without updating consumer pact fails CI.

### [III.14.4] Property-Based Tests — fast-check
- **Ref** §14.4 · **Kind** Build · **Mode** Execute

```text
Add `fast-check` to Jest. Write property tests for:
  • Money arithmetic (commutativity, rounding),
  • Itinerary scorer (monotonicity: adding a highly-rated place never lowers score),
  • Haversine distance (symmetry).
```

**Acceptance:** 3 property suites green; seeded runs reproducible.

### [III.14.5] Load Tests — k6 in CI
- **Ref** §14.5 · **Kind** Build · **Mode** Execute

```text
Create `tests/load/` with k6 scripts covering: auth/login, places/search, trip/generate (mock AI). SLOs per §15.6. Nightly GitHub Action runs against staging; fail if p95 breaches SLO.
```

**Acceptance:** nightly run publishes a Grafana k6 dashboard link in Slack.

### [III.14.6] Chaos Tests — Toxiproxy
- **Ref** §14.6 · **Kind** Build · **Mode** Execute

```text
Add Toxiproxy to `docker-compose.yml`. Monthly GitHub Action injects 500ms DB latency + 10% packet loss, asserts SLOs, then resets. Output a report to `docs/chaos/<date>.md`.
```

**Acceptance:** chaos run produces a report; unexpected error types fail the run.

### [III.14.7] Example Test Enforcement
- **Ref** §14.7 · **Kind** Build · **Mode** Execute

```text
Enshrine the §14.7 radius-exceeds example as the canonical use-case test shape. Lint rule: every use-case must have at least one test file `*.use-case.spec.ts` next to it.
```

**Acceptance:** ESLint rule flags any use-case missing its spec file.

---

## Chapter 15 — Observability & Error Handling

### [III.15.1] Error Model Package
- **Ref** §15.1 · **Kind** Build · **Mode** Execute

```text
Build `packages/errors`:
  - src/base.error.ts: abstract DomainError with code, httpStatus, context, timestamp, toJSON.
  - src/errors.ts: concrete classes (NotFoundError 404, ValidationError 422, UnauthorizedError 401, ForbiddenError 403, ConflictError 409, RateLimitError 429, ExternalServiceError 502, InvariantError 500, plus domain-specific: TripNotFoundError, PlaceNotFoundError, UserNotFoundError, AgentNotVerifiedError, InvalidRadiusError, PaymentFailedError, SafetyCheckFailedError 451).
  - src/index.ts: barrel.
```

**Acceptance:** JSON serialisation produces `{code, message, context}`; no stack traces.

### [III.15.2] Logging Pipeline + PII Redact
- **Ref** §15.2 · **Kind** Build · **Mode** Execute · **Depends on** [III.11.6]

```text
Ensure Pino is configured with the full redact list from §15.2 PLUS: `*.ssn`, `*.passport`, `*.creditCard`, `*.mfaSecret`. Add a regression test that logs an object containing every sensitive key and asserts none appear in the output.
```

**Acceptance:** test passes; prod logs stream to Grafana Loki via stdout + logql alerts configured.

### [III.15.3] Metrics — prom-client
- **Ref** §15.3 · **Kind** Build · **Mode** Execute

```text
Expose `/metrics` in `apps/api`. Register:
  • RED per HTTP route,
  • counters: trips_generated, trips_completed, sos_triggered, bookings_converted, ai_requests_total{model,operation}, ai_cache_hits_total,
  • gauges: active_trips_current, queue_depth{queue}.
```

**Acceptance:** Prometheus scrapes successfully; counters move in integration tests.

### [III.15.4] Tracing — OpenTelemetry
- **Ref** §15.4 · **Kind** Build · **Mode** Execute

```text
In `packages/observability`:
  - src/tracing.ts: NodeSDK with auto-instrumentations (http, fastify, nest, prisma, ioredis, undici),
  - src/init.ts: `initTracing(serviceName)` called before any imports in `apps/api/instrumentation.ts`.
Resource attributes: service.name, service.version (from package.json), deployment.environment.
Export to Jaeger in dev (local Docker), Grafana Tempo in prod.
```

**Acceptance:** Jaeger UI shows a full span tree for one request; Prisma query spans appear.

### [III.15.5] Alerting Rules + Routing
- **Ref** §15.5 · **Kind** Design · **Mode** Execute

```text
Write `infra/grafana/alerts/` rules:
  • SLO-burn (fast + slow) per route class,
  • Sentry issue escalation to Slack #alerts and PagerDuty (Sev 1/2 only),
  • DLQ depth > 100 for any BullMQ queue,
  • ai-service p95 > 2s.
```

**Acceptance:** firing a synthetic alert reaches Slack within 2 min.

### [III.15.6] SLO Catalogue
- **Ref** §15.6 · **Kind** Design · **Mode** Execute

```text
Write `docs/slo/slo-catalog.md`:
  • trip gen p95 < 3s (end-to-end, excluding user think time),
  • places search p95 < 300ms,
  • auth login p95 < 200ms,
  • availability 99.5% rolling 30d,
  • translation p95 < 800ms.
For each SLO define its SLI query (PromQL) and error budget policy.
```

**Acceptance:** catalogue links to a Grafana dashboard panel per SLO.

### [III.15.7] Dashboards as Code
- **Ref** §15.7 · **Kind** Build · **Mode** Execute

```text
Provision Grafana dashboards via JSON in `infra/grafana/dashboards/`:
  • overview.json (RED + SLO burn + active users),
  • trips.json (per-funnel),
  • ai.json (tokens spent, cache hit rate, fallback chain activations),
  • safety.json (SOS rate, scam reports heatmap).
Grafana provisioning YAML loads them at startup.
```

**Acceptance:** fresh Grafana container comes up with all 4 dashboards populated.

### [III.15.8] Documentation Pipeline
- **Ref** §15.8 · **Kind** Build · **Mode** Execute

```text
Automate:
  • OpenAPI via `@nestjs/swagger` → `docs/api/openapi.yaml` committed on merge,
  • SDK regeneration via orval → `packages/sdk`; CI fails if generated SDK is out-of-date,
  • Storybook builds for `packages/ui` and `packages/mobile-ui` deployed to Chromatic,
  • MADR template copied into ADR folder; `docs/onboarding.md` walks through day-1 setup.
```

**Acceptance:** PR that changes a controller without regenerating SDK is blocked.

---

# PART IV — The Build Compendium

## Chapter 16 — Feasibility Verdict

### [IV.16.1] Score Acknowledgement
- **Ref** §16.1 · **Kind** Seed · **Mode** Execute

```text
Acknowledge the compendium rating of 8/10 and commit to completing the Chapter 17–19 upgrades before any Phase 0 build prompt outside of monorepo scaffold [II.10.0] is executed.
```

**Acceptance:** acknowledgement stored to `docs/agent-contract.md`.

### [IV.16.2] Scorecard — Upgrade Plan
- **Ref** §16.2 · **Kind** Design · **Mode** Execute

```text
For every dimension in the scorecard, map at least one later prompt that raises the score. Output as `docs/compendium-upgrade-map.md`.
```

**Acceptance:** each dimension has a named prompt (by ID) that addresses it.

### [IV.16.3] Realistic Timeline Buy-In
- **Ref** §16.3 · **Kind** Design · **Mode** Ask

```text
Confirm the team shape (solo / 2-dev / 4-dev) with the user. Update `docs/roadmap.md` with the chosen shape's timeline. Flag any phase where exit criteria slip more than 2 weeks.
```

**Acceptance:** explicit user confirmation recorded in the doc.

### [IV.16.4] Pre-Agent Upgrade Verdict
- **Ref** §16.4 · **Kind** Verify · **Mode** Execute

```text
Before running any prompt in Parts I–III that touches code, verify the Part 0 CLAUDE.md is present and contains the full System Rules. If missing, STOP.
```

**Acceptance:** verification passes.

---

## Chapter 17 — Bugs in the v1 Compendium (Fix Inline)

### [IV.17.1] Dependency Fix-Up
- **Ref** §17.1 · **Kind** Refactor · **Mode** Execute

```text
Audit any existing Phase 0 package.json files. Replace `@nestjs/bull` → `@nestjs/bullmq`. Add `@nestjs/terminus`, `@fastify/csrf-protection`, `@nestjs/cache-manager` + `cache-manager-redis-yet`. Move `pino-pretty` to devDependencies and guard import by NODE_ENV.
```

**Acceptance:** `pnpm install` resolves; `node -e "require('@nestjs/bull')"` fails if reintroduced (grep in CI).

### [IV.17.2] Prisma Schema Fixes
- **Ref** §17.2 · **Kind** Refactor · **Mode** Execute · **Depends on** [III.12.1]

```text
Patch `schema.prisma`:
  • extensions line to `[postgis, postgisTopology, vector, pg_trgm, pgcrypto]`,
  • `@@unique([emailHash])` on User,
  • indexes from §12.4 present,
  • decide soft-delete via [III.12.6] ADR-010 — remove `deletedAt` from User if option B.
```

**Acceptance:** a new migration reflects the fixes; existing data unaffected.

### [IV.17.3] Security Gap Remediation Sweep
- **Ref** §17.3 · **Kind** Verify · **Mode** Execute

```text
Run a checklist against the auth module covering S1–S8 from §17.3. For each gap, either confirm implemented (link the prompt) or file a blocker issue `docs/blockers/security-gap-<Sn>.md`.
```

**Acceptance:** all 8 gaps mapped to an implementing prompt.

### [IV.17.4] Observability Gap Sweep
- **Ref** §17.4 · **Kind** Verify · **Mode** Execute

```text
Confirm: PII scrubbing configured (from [III.15.2]), SLO catalogue exists (from [III.15.6]), dashboards-as-code committed (from [III.15.7]), error-budget policy written at `docs/runbooks/error-budget-policy.md`. Any missing → create follow-up prompt IDs.
```

**Acceptance:** no gap remains unowned.

### [IV.17.5] Testing Infrastructure Sweep
- **Ref** §17.5 · **Kind** Verify · **Mode** Execute

```text
Confirm Block 0.7 (Testing Infrastructure — see [V.18.1.1]) is DONE before unlocking Phase 1 domain-module prompts. If not, block them.
```

**Acceptance:** gating lint/CI step enforces the order.

### [IV.17.6] Prompt-Block Level Fixes
- **Ref** §17.6 · **Kind** Refactor · **Mode** Execute

```text
  • `packages/shared-types/src/place-category.ts` — enumerate all 50 categories or migrate to a DB-driven `PlaceCategory` table.
  • Create `apps/api/instrumentation.ts` if missing; imported first in `main.ts`.
  • Root `tsconfig.json` paths: `"@app/*": ["packages/*/src"]`.
```

**Acceptance:** agent can resolve `import { EnvSchema } from '@app/config'` everywhere.

---

## Chapter 18 — Missing Blocks

> Each missing block from §18.1/§18.2 gets one prompt.

### [IV.18.1.7] Testing Infrastructure Block
- **Ref** §18.1 [0.7] · **Kind** Build · **Mode** Plan-first

```text
Stand up Testcontainers (Postgres+Redis+Meilisearch per integration test file). Add `@faker-js/faker` + a Factory pattern (`test/factories/<model>.factory.ts`). Install MSW for external-API mocking. Global setup migrates a disposable DB per worker.
```

**Acceptance:** sample integration test spins a fresh Postgres, runs, tears down in < 15s.

### [IV.18.1.8] Seeding & Migration Playbook
- **Ref** §18.1 [0.8] · **Kind** Build · **Mode** Execute

```text
  • `prisma/seed.ts` with `--dev`, `--test`, `--demo` flags (idempotent upserts),
  • `docs/db/migration-playbook.md` — add-then-backfill-then-drop pattern, naming convention,
  • `prisma/seeds/cities/*.ts` — one seeded launch city.
```

**Acceptance:** `pnpm prisma db seed -- --demo` loads a full demo city.

### [IV.18.1.9] Event Bus Package
- **Ref** §18.1 [0.9] · **Kind** Build · **Mode** Plan-first

```text
Build `packages/events`:
  • typed EventBus interface with `publish<E>(event)` and `subscribe<E>(name, handler)`,
  • Redis Streams adapter with consumer groups per module,
  • dead-letter stream,
  • in-memory adapter for tests.
Swap-to-Kafka path documented.
```

**Acceptance:** sample publisher/subscriber delivers across consumer groups; DLQ receives a forced-fail event.

### [IV.18.1.10] Feature Flags + Remote Config
- **Ref** §18.1 [0.10] · **Kind** Build · **Mode** Execute

```text
  • OpenFeature client + PostHog provider.
  • `@FeatureFlag('x')` decorator.
  • Remote config table (`settings`) with Redis pub/sub invalidation.
  • Admin endpoints to edit flags (admin-only, audit-logged).
```

**Acceptance:** toggling a flag in PostHog changes behaviour live without redeploy.

### [IV.18.1.11] CI/CD Pipeline
- **Ref** §18.1 [0.11] · **Kind** Build · **Mode** Plan-first

```text
Create the five workflows per §33.1:
  • ci.yml, security.yml, cd.yml, preview.yml, release.yml.
Turbo remote cache configured. Preview deploys: Fly (api), Vercel (web/admin), Expo preview build (mobile). Release via changesets.
```

**Acceptance:** opening a PR produces 3 preview URLs in a PR comment.

### [IV.18.1.12] API SDK Auto-Generation
- **Ref** §18.1 [0.12] · **Kind** Build · **Mode** Execute

```text
Configure orval to generate `packages/sdk` from `docs/api/openapi.yaml` with React Query hooks. CI fails if OpenAPI changed but SDK was not regenerated (diff check).
```

**Acceptance:** `pnpm --filter=@app/sdk typecheck` green; stale SDK fails CI.

### [IV.18.1.13] i18n Foundation
- **Ref** §18.1 [0.13] · **Kind** Build · **Mode** Plan-first

```text
  • `packages/i18n` with ICU messageformat.
  • `next-intl` for web, `i18next` for mobile.
  • `i18next-parser` key extraction in CI.
  • Namespaces: common, auth, trip, places, stays, safety, notifications, errors.
Do this now — retrofitting is 10× more expensive (§18.1).
```

**Acceptance:** calling `t('auth.login.title')` renders in 3 locales (en, hi, es).

### [IV.18.1.14.a] apps/web Scaffold
- **Ref** §18.1 [0.14.a] · **Kind** Build · **Mode** Plan-first · **Subagent** Plan

```text
Bootstrap `apps/web` (Next.js 15):
  App Router, RSC, Server Actions. shadcn/ui + Tailwind. Auth middleware (session cookie). SDK integration. PostHog client. Sentry browser. next-intl. Themes from [I.5.1]. ErrorBoundary, 404/500, robots.txt, sitemap.xml, OpenGraph metadata. Marketing + app layout split.
```

**Acceptance:** `pnpm dev --filter=web` serves; `/` shows marketing, `/app/*` shows app layout.

### [IV.18.1.14.b] apps/admin Scaffold
- **Ref** §18.1 [0.14.b] · **Kind** Build · **Mode** Execute

```text
Bootstrap `apps/admin` (Next.js 15): stricter RBAC (admin-only), no marketing, audit logging on every mutation, separate Vercel project, optional IP allowlist via middleware + env var.
```

**Acceptance:** non-admin token on any admin route → 403 audited.

### [IV.18.1.14.c] apps/mobile Scaffold
- **Ref** §18.1 [0.14.c] · **Kind** Build · **Mode** Plan-first

```text
Bootstrap `apps/mobile` (Expo 51):
  expo-router. Tamagui. MMKV for non-sensitive cache, expo-secure-store for tokens. Biometric auth. expo-notifications → FCM/APNs. Deep linking schema. OTA update policy (critical vs non-critical). Sentry. i18n wired.
```

**Acceptance:** build runs on iOS + Android simulators; sign-in → home works.

### [IV.18.1.15] Idempotency & Webhooks
- **Ref** §18.1 [0.15] · **Kind** Build · **Mode** Execute

```text
  • IdempotencyKeyInterceptor: hash request; 24h cache in Redis; replay returns cached response.
  • Stripe webhook handler verifying signature.
  • Generic webhook framework (Booking.com, Twilio) with adapter registry.
```

**Acceptance:** replaying a POST within 24h returns identical response.

### [IV.18.1.16] Health / Readiness / Liveness
- **Ref** §18.1 [0.16] · **Kind** Build · **Mode** Execute

```text
Using `@nestjs/terminus`:
  • GET /health/live — app up, no dep checks.
  • GET /health/ready — Postgres + Redis + ai-service + Meilisearch healthy.
  • GET /health/startup — migrations applied + seed caches warmed.
```

**Acceptance:** Fly.io checks pass; killing Redis flips `/ready` to 503.

### [IV.18.1.17] Security Headers + CORS + CSP
- **Ref** §18.1 [0.17] · **Kind** Build · **Mode** Execute

```text
Strict CSP with per-request nonces. Per-env CORS allowlist from env var (comma-separated). Trusted Types, COOP, COEP, Permissions-Policy. Test matrix in `tests/security/headers.spec.ts`.
```

**Acceptance:** every header present in prod mode; test matrix passes.

### [IV.18.1.18] Phase 0 Smoke Suite
- **Ref** §18.1 [0.18] · **Kind** Build · **Mode** Execute

```text
Create `tests/smoke/phase-0.smoke.ts` that runs every Acceptance Criterion from Phase 0 prompts in one Jest suite. Adds a GitHub Action gate: Phase 0 smoke must be green before Phase 1 prompts may open PRs.
```

**Acceptance:** failing any AC breaks the smoke suite.

### [IV.18.2.3] Stays Module
- **Ref** §18.2 [1.3] · **Kind** Build · **Mode** Plan-first

```text
Build `modules/stays`:
  domain: Stay entity, StayType VO, price policy,
  application: SearchStaysUseCase, GetStayDetailUseCase,
  infrastructure: Booking.com adapter, Amadeus adapter, price history repo,
  interface: REST endpoints + Zod DTOs.
Dedup stays across providers by (name + geo + embedding similarity).
```

**Acceptance:** searching a city returns merged results; clicking "book" emits `booking_initiated` with correct affiliate URL.

### [IV.18.2.4] Food & Tryouts Module
- **Ref** §18.2 [1.4] · **Kind** Build · **Mode** Plan-first

```text
Build `modules/food`:
  domain: Eatery, Dish, DishTag,
  application: SearchEateriesUseCase, RecommendDishesUseCase (embeds dish text + ranks by local popularity),
  infra: Google Places + Foursquare adapters,
  interface: REST.
Dietary filter strictly excludes non-matching.
```

**Acceptance:** searching with dietary=vegan never returns non-vegan eateries.

### [IV.18.2.5] Transport & Routing Module
- **Ref** §18.2 [1.5] · **Kind** Build · **Mode** Plan-first

```text
Build `modules/transport`:
  domain: RouteLeg, TransportMode, feasibility scorer,
  application: AnalyzeLegUseCase (given start/end/mode → feasibility, ETA, distance), GetTransitUseCase,
  infra: Mapbox Directions + GTFS feeds + ride-hail deep-link builders,
  interface: REST.
```

**Acceptance:** an infeasible leg (100km on foot) returns `feasibility: 'infeasible'` with alternatives.

### [IV.18.2.6] Weather Module
- **Ref** §18.2 [1.6] · **Kind** Build · **Mode** Execute

```text
Build `modules/weather`:
  infra: Open-Meteo adapter + 30-min Redis cache,
  application: GetForecastUseCase, GetAlertsUseCase,
  events: publishes WeatherAlertEvent when severity ≥ warning.
```

**Acceptance:** cache-hit rate ≥ 80% in steady state (assert via unit test metric).

### [IV.18.2.7] Translation Module
- **Ref** §18.2 [1.7] · **Kind** Build · **Mode** Execute

```text
Build `modules/translation` — thin proxy to ai-service:
  Cache by sha256(text+target) for 7d in Redis. Auto-detect source. On-device NLLB fallback for mobile offline pack.
```

**Acceptance:** cache hit rate ≥ 70% across the test corpus.

### [IV.18.2.8] Offline Pack Generator
- **Ref** §18.2 [1.8] · **Kind** Build · **Mode** Plan-first

```text
Generate an offline bundle (map tiles for itinerary bbox + itinerary JSON + translator phrases for destination language). Versioned, signed, delivered via signed S3 URL. Client (mobile) unpacks into WatermelonDB + MMKV.
```

**Acceptance:** phone in airplane mode after download can still view itinerary, translate, and navigate map.

### [IV.18.2.9] Notifications Module
- **Ref** §18.2 [1.9] · **Kind** Build · **Mode** Plan-first

```text
Build `modules/notifications` + `apps/notification-worker`:
  Multi-channel (push/email/SMS), user preferences, DND + quiet hours (timezone-aware), priority matrix, dedup.
```

**Acceptance:** quiet-hours window suppresses non-emergency notifications; SOS bypasses quiet hours.

### [IV.18.2.10] Payments Module
- **Ref** §18.2 [1.10] · **Kind** Build · **Mode** Plan-first

```text
Build `modules/payments`:
  Stripe subs + Connect for agent escrow, affiliate commission tracking, idempotent webhook handler, chargeback flow.
```

**Acceptance:** paying, refunding, and chargebacks each produce correct ledger rows and analytics events.

### [IV.18.2.11] ai-service Skeleton
- **Ref** §18.2 [1.11] · **Kind** Build · **Mode** Plan-first

```text
Bootstrap `apps/ai-service` (Python 3.12, FastAPI, Ray Serve):
  endpoints for translate (NLLB-200), transcribe (Whisper small), classify-review (DistilBERT stub), embed (sentence-transformers), predict-crowd (stub).
gRPC + REST. Health + metrics. Dockerised.
```

**Acceptance:** `curl ai-service:8001/health/ready` returns 200; each endpoint has a unit test.

### [IV.18.2.12] Mobile Offline-First Trip Viewer
- **Ref** §18.2 [1.12] · **Kind** Build · **Mode** Plan-first

```text
Build offline-first Trip viewer in mobile:
  WatermelonDB schema, sync protocol (last-write-wins with conflict detection), pending-ops queue, sync-status UI.
```

**Acceptance:** editing offline then coming back online reconciles without data loss; conflicts surface an explicit merge UI.

### [IV.18.2.13] Phase 1 Smoke Suite
- **Ref** §18.2 [1.13] · **Kind** Build · **Mode** Execute

```text
`tests/smoke/phase-1.smoke.ts` hits every Phase 1 happy path end-to-end. Gate Phase 2 prompts on it.
```

**Acceptance:** CI gate enforced.

---

## Chapter 19 — Agent Meta-Layer

### [IV.19.1] Paste System Rules
- **Ref** §19.1 · **Kind** Build · **Mode** Execute

```text
Copy Part 0 (System Rules) into the repo root `CLAUDE.md` verbatim. Also add `docs/agent-contract.md` collecting all agent acknowledgements.
```

**Acceptance:** Claude Code reads the rules on every session start.

### [IV.19.2] Context-Carry Protocol
- **Ref** §19.2 · **Kind** Design · **Mode** Execute

```text
Formalise context carry in `docs/prompts/context-carry.md`:
  • The user pastes a CONTEXT SUMMARY at the start of each prompt session.
  • Summary template: last prompt id, files created, key exports, decisions, deviations.
```

**Acceptance:** template exists; referenced from CLAUDE.md.

### [IV.19.3] Output Format Enforcement
- **Ref** §19.3 · **Kind** Build · **Mode** Execute

```text
Add a custom Claude Code slash command (via `~/.claude/commands/end-prompt.md`) that emits the required end-of-session block (FILES CREATED / EDITED / DEPS / COMMANDS / VERIFICATION / NEXT).
```

**Acceptance:** `/end-prompt` produces the block from the current session's changes.

### [IV.19.4] Self-Check Hook
- **Ref** §19.4 · **Kind** Build · **Mode** Execute

```text
Add a Stop hook in `.claude/settings.json` that runs:
  `pnpm turbo run typecheck lint test --filter=... <changed>`
before Claude Code declares the session complete. Any failure leaves the prompt in-progress.
```

**Acceptance:** intentionally-broken TS triggers the hook and blocks the end.

### [IV.19.5] Escalation Protocol
- **Ref** §19.5 · **Kind** Seed · **Mode** Execute

```text
Reinforce: when blocked, produce the BLOCKED report (what tried / what failed with exact error / what needed). Never guess.
```

**Acceptance:** acknowledgement in `docs/agent-contract.md`.

### [IV.19.6] Per-Block Footers
- **Ref** §19.6 · **Kind** Design · **Mode** Execute

```text
Update each prompt in this archive post-execution with: token-budget actual, files created, common pitfalls observed, rollback notes. Feeds the retrospective per §24.3.
```

**Acceptance:** `docs/blocks/<id>/retrospective.md` filled for every completed prompt.

---

## Chapter 20 — Recommended Compendium TOC

### [IV.20.0] Phase Gating
- **Ref** §20 · **Kind** Build · **Mode** Execute

```text
Implement `tools/check-phase-gate.ts` invoked in CI: reads `docs/prompts/status.md`; enforces ordering (no Phase N+1 prompt may reach DONE while any Phase N prompt is not DONE or explicitly-waived by an ADR).
```

**Acceptance:** intentional gate violation fails CI; waiver ADR passes it.

---

# PART V — Economics

## Chapter 21 — Build-Time Token Economics

### [V.21.1] Per-Block Cost Budgeting
- **Ref** §21.1 · **Kind** Design · **Mode** Execute

```text
Produce `docs/prompts/cost-budget.md`: one row per prompt with estimated input/output tokens and model assignment from §21.3. Sum by Phase. Compare against the §21.1 totals.
```

**Acceptance:** Phase 0+1 estimate lands within ±20% of §21.1 ranges.

### [V.21.2] Prompt-Cache Configuration
- **Ref** §21.2 · **Kind** Build · **Mode** Execute

```text
Document the cache-layer plan in `docs/prompts/cache-layers.md` and, in the `claude-api` skill usage for internal tooling, apply `cache_control: ephemeral` markers for the three layers from §21.2.
```

**Acceptance:** API logs show `cache_read_input_tokens` > 60% after warm-up on repeat prompts.

### [V.21.3] Model Routing Rule
- **Ref** §21.3 · **Kind** Design · **Mode** Execute

```text
Add a front-matter tag `model:` to every prompt in this archive. Values: `haiku|sonnet|opus`. Default to sonnet; set scaffold/test prompts to haiku; design-heavy to opus. Commit a grep script that validates every prompt has a model tag.
```

**Acceptance:** grep passes; random spot-check matches §21.3 policy.

### [V.21.4] Budget Alarms
- **Ref** §21.4 · **Kind** Build · **Mode** Execute

```text
Configure Anthropic usage alerts ($10/$50/$100). Stripe weekly budget. GHA 50k-min cap. Fly/Vercel/Supabase auto-upgrade disabled. Doc at `docs/runbooks/runbook-cost-spikes.md`.
```

**Acceptance:** synthetic cost spike triggers Slack alert.

---

## Chapter 22 — Runtime LLM Economics

### [V.22.1] Per-Feature Cost Tracking
- **Ref** §22.1 · **Kind** Build · **Mode** Execute

```text
Emit `ai_cost_cents{feature,model}` metric per call. Grafana panel shows rolling cost/user/mo vs the §22.1 target ($0.15 with caching).
```

**Acceptance:** panel populated; alert at $0.30/MAU.

### [V.22.2] Caching Lever Implementation
- **Ref** §22.2 · **Kind** Build · **Mode** Execute · **Depends on** [IV.18.2.7]

```text
  • Translation cache: sha256(text+target), 7d TTL.
  • Prompt-cache markers on SYSTEM + schemas for every Claude call.
  • Itinerary template cache keyed by (city, preferences-hash), 24h TTL; bypass on fresh events.
```

**Acceptance:** translation cache hit ≥ 70% after 2 weeks of traffic (measured from metric).

### [V.22.3] Profitability Rule
- **Ref** §22.3 · **Kind** Verify · **Mode** Execute

```text
Add a weekly cost-vs-revenue reporter that cross-references `ai_cost_cents` against `booking_completed` commissions. Alert if blended LTV − COGS falls below $0.50/MAU.
```

**Acceptance:** reporter runs via cron; alert path tested.

---

## Chapter 23 — Unit Economics & Break-Even

### [V.23.1] COGS Tracking Dashboard
- **Ref** §23.1 · **Kind** Build · **Mode** Execute

```text
Grafana dashboard `cogs.json`: infra, LLM, places APIs, maps, satellite, comms, observability. Target $0.40/MAU. Include 30d trend.
```

**Acceptance:** dashboard provisioned.

### [V.23.2] ARPU Tracking
- **Ref** §23.2 · **Kind** Build · **Mode** Execute

```text
Grafana dashboard `arpu.json`: affiliate commissions, subscriptions, sponsored. Target $0.80–1.40 blended. Segment by country and user type.
```

**Acceptance:** dashboard provisioned.

### [V.23.3] Break-Even Visualisation
- **Ref** §23.3 · **Kind** Build · **Mode** Execute

```text
Combine COGS + ARPU into `break-even.json` with projected MAU to contribution break-even ($25k/mo). Include an editable burn-rate slider (via dashboard variables).
```

**Acceptance:** dashboard shows current distance to break-even.

### [V.23.4] Cost-Lever Simulator
- **Ref** §23.4 · **Kind** Build · **Mode** Execute

```text
CLI `tools/lever-simulator.ts` lets stakeholders toggle levers (prompt caching, Llama fine-tune, Pro price, conversion rate, direct hotel deals) and see projected COGS/ARPU/break-even.
```

**Acceptance:** output matches §23.4 impact ranges within 10%.

### [V.23.5] Business-Killer Watchlist
- **Ref** §23.5 · **Kind** Verify · **Mode** Execute

```text
Create alerts for each killer in §23.5: LLM COGS spike, Google Places spend > budget, affiliate clawbacks > reserve, CAC > LTV/3. Each alert links to a runbook.
```

**Acceptance:** 4 alerts configured; synthetic trigger routes correctly.

---

# PART VI — Execution Playbook

## Chapter 24 — Block Lifecycle State Machine

### [VI.24.1] Lifecycle States in Code
- **Ref** §24.1 · **Kind** Build · **Mode** Execute

```text
Encode the 8-state enum in `tools/prompts/lifecycle.ts` and enforce valid transitions. `pnpm prompt:next <id>` advances state with a pre-flight check per §24.2.
```

**Acceptance:** invalid transition is rejected with a clear error.

### [VI.24.2] Exit Criteria Enforcement
- **Ref** §24.2 · **Kind** Build · **Mode** Execute

```text
For each state, wire a checker (CODED: pnpm build, TYPECHECKED: pnpm typecheck, UNIT-TESTED: coverage gate, etc.). The CLI from [VI.24.1] invokes the checker.
```

**Acceptance:** a prompt can't reach VERIFIED while any earlier checker fails.

### [VI.24.3] Artefacts Directory
- **Ref** §24.3 · **Kind** Build · **Mode** Execute

```text
`docs/blocks/<id>/` auto-created when a prompt starts. Template files: spec.md, draft.md, diff.patch (generated by post-session hook), test-output.txt, verification.md, retrospective.md.
```

**Acceptance:** new prompt produces the full folder.

### [VI.24.4] Rollback Scripts
- **Ref** §24.4 · **Kind** Build · **Mode** Execute

```text
`tools/prompts/rollback.ts <id>` reverts based on current state: delete draft (DRAFTED), `git checkout` (CODED/TYPECHECKED), `git revert` (UNIT-TESTED+). Never `git reset --hard` automatically.
```

**Acceptance:** dry-run mode prints plan; --yes executes.

---

## Chapter 25 — Parallelization & Dependency DAG

### [VI.25.1] DAG as Data
- **Ref** §25.1 · **Kind** Build · **Mode** Execute

```text
Encode prompt dependencies in `docs/prompts/dag.yaml` (nodes = prompt ids, edges = depends-on). Lint enforces that every Depends-on cited in this archive is a real node.
```

**Acceptance:** DAG validator green.

### [VI.25.2] Parallelization Advisor
- **Ref** §25.2 · **Kind** Build · **Mode** Execute

```text
`pnpm prompt:parallelizable` reads the DAG + status.md, prints prompt IDs that are currently unblocked and can run concurrently. Respect the ⚠️ pairs (contract-first) from §25.2.
```

**Acceptance:** running after Phase 0 complete proposes the Phase 1 parallel fan-out.

### [VI.25.3] Critical Path Report
- **Ref** §25.3 · **Kind** Build · **Mode** Execute

```text
`pnpm prompt:critical-path` produces an ASCII Gantt with the longest chain to a chosen milestone (default: Phase 1 complete). Uses team-size multiplier from §25.3.
```

**Acceptance:** output agrees with §25.3 weeks within 10% for solo.

---

## Chapter 26 — Agent-Tool Optimization

### [VI.26.1] Claude Code Setup
- **Ref** §26.1 · **Kind** Build · **Mode** Execute

```text
Populate repo root with:
  • CLAUDE.md (Part 0 rules + link to this archive).
  • .claude/settings.json with Stop hook from [IV.19.4], PreToolUse hook blocking forbidden paths.
  • ~/.claude/commands/end-prompt.md, ~/.claude/commands/context-carry.md.
Document plan-first workflow in `docs/claude-code-setup.md`.
```

**Acceptance:** opening Claude Code in a fresh clone loads rules; hooks fire.

### [VI.26.2] Cursor Rules
- **Ref** §26.2 · **Kind** Build · **Mode** Execute

```text
Add `.cursor/rules/` mirroring the System Rules. Include a rule: "When cold-start scaffolding is needed, pass to Claude Code first." Commit.
```

**Acceptance:** Cursor agent respects the rules in a dry-run test.

### [VI.26.3] GitHub Copilot Config
- **Ref** §26.3 · **Kind** Build · **Mode** Execute

```text
Add `.github/copilot-instructions.md` saying: treat Copilot as typing accelerator, run against post-signed-off code only, never accept architectural suggestions. Include reference to this archive.
```

**Acceptance:** file present and concise (< 120 lines).

### [VI.26.4] Aider Config
- **Ref** §26.4 · **Kind** Build · **Mode** Execute

```text
Add `.aider.conf.yml` setting `model: claude-sonnet-4-5`, `cache-prompts: true`, `auto-commits: false`, and pointing at `CLAUDE.md` + this archive as read files.
```

**Acceptance:** Aider picks up the config on launch.

### [VI.26.5] Tool-Routing Matrix
- **Ref** §26.5 · **Kind** Design · **Mode** Execute

```text
Write `docs/agents/routing.md` recommending which agent handles which prompt class:
  • Claude Code: domain-heavy builds (I.5.2, II.10, III.11–15).
  • Cursor: bug-fix loops, polish.
  • Aider: anti-pattern sweeps (VII.27).
  • Copilot: test generation (III.14, post-sign-off).
```

**Acceptance:** every prompt range is mapped to a primary tool.

---

# PART VII — Quality & Safety

## Chapter 27 — Anti-Pattern Library

### [VII.27.1] Prisma Anti-Pattern Sweep
- **Ref** §27.1 · **Kind** Refactor · **Mode** Plan-first · **Subagent** general-purpose

```text
Scan the repo for: N+1 (findMany in a loop), prisma.place.create with coordinates string, prisma.$transaction wrapping network calls. For each hit, propose the refactor from §27.1. Open a PR per module touched.
```

**Acceptance:** grep confirms zero instances remain.

### [VII.27.2] NestJS Anti-Pattern Sweep
- **Ref** §27.2 · **Kind** Refactor · **Mode** Plan-first

```text
Scan for: fat controllers (>20 lines of logic not calling a use case), PrismaService injected into any `application/` file. Refactor to use-case pattern + repository port. PR per module.
```

**Acceptance:** ESLint rule added catching both anti-patterns.

### [VII.27.3] Async Anti-Pattern Sweep
- **Ref** §27.3 · **Kind** Refactor · **Mode** Execute

```text
Find sequential awaits of independent calls → replace with Promise.all. Find Promise.all on non-critical fanout → replace with Promise.allSettled. Write an ESLint rule for the latter using AST hints.
```

**Acceptance:** lint rule catches new offenders.

### [VII.27.4] Type Anti-Pattern Sweep
- **Ref** §27.4 · **Kind** Refactor · **Mode** Execute

```text
Replace every `any`, unsafe `as`, and `!` non-null with typed guards (`assertDefined`, Zod parse). Add `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-non-null-assertion` as errors.
```

**Acceptance:** lint green; CI blocks reintroductions.

### [VII.27.5] Security Anti-Pattern Sweep
- **Ref** §27.5 · **Kind** Refactor · **Mode** Plan-first

```text
Find: logs with `body` or `req` objects (redact leaks), endpoints with `:id` params but no ownership check (IDOR). Refactor. Add a custom ESLint rule that flags endpoints missing CurrentUser + policy.
```

**Acceptance:** lint rule catches new cases; no existing offenders remain.

### [VII.27.6] React/Next.js Anti-Pattern Sweep
- **Ref** §27.6 · **Kind** Refactor · **Mode** Plan-first

```text
Find: client-side fetch in useEffect where RSC would suffice; any localStorage write of tokens. Refactor to RSC + memory-only access tokens. Add Cursor rule documenting both cases.
```

**Acceptance:** all data fetching that can be server-side now is server-side.

---

## Chapter 28 — In-App AI Prompts

### [VII.28.1] Itinerary Generator Prompt (Production)
- **Ref** §28.1 · **Kind** Build · **Mode** Plan-first · **Depends on** [IV.18.2.11]

```text
Implement `apps/ai-service/prompts/itinerary_v1.txt` (the SYSTEM exactly per §28.1) + Zod schema for the JSON output. Add a 2-attempt self-repair loop: attempt 2 gets attempt 1's Zod errors prepended. Instrument token counters + latency.
```

**Acceptance:** 100-seed test fixture produces valid JSON > 99% of the time.

### [VII.28.2] Re-Planner Prompt
- **Ref** §28.2 · **Kind** Build · **Mode** Plan-first

```text
Implement `apps/ai-service/prompts/replan_v1.txt` producing a JSON diff `{replace, insert, remove}`. Preserve completed items. Flag booked items for user confirmation before drop.
```

**Acceptance:** re-plan never removes a completed or booked item silently.

### [VII.28.3] Translator Contract
- **Ref** §28.3 · **Kind** Build · **Mode** Execute · **Depends on** [IV.18.2.7]

```text
ai-service gRPC/REST endpoint `/translate` accepting `{text, source_lang?, target_lang}`. Uses NLLB-200. Auto-detect source via langdetect when missing. Returns `{translated, detected_source, confidence}`.
```

**Acceptance:** round-trip test covers 10 language pairs; confidence reported.

### [VII.28.4] Fake-Review Classifier
- **Ref** §28.4 · **Kind** Build · **Mode** Plan-first

```text
Train DistilBERT on public labelled datasets (TripAdvisor + Yelp fake-review). Deploy as ai-service endpoint returning `{fake_probability, signals[]}`. Integrate into Review write flow with thresholds from §28.4.
```

**Acceptance:** hold-out accuracy > 0.85; pipeline blocks writes with p > 0.85.

### [VII.28.5] Scam Detector via Vector Similarity
- **Ref** §28.5 · **Kind** Build · **Mode** Execute

```text
Every new place/agent/listing: embed via ai-service, k-NN search against `scam_embedding` index. If avg similarity of top-10 > 0.7 → flag for moderation.
```

**Acceptance:** synthetic seeded scam flags correctly.

### [VII.28.6] Safety-Bot Tool-Only Chat
- **Ref** §28.6 · **Kind** Build · **Mode** Plan-first

```text
Implement a Haiku-powered chat surface constrained to the tools listed in §28.6. Out-of-scope questions return the canned decline string verbatim. Tool routing uses structured outputs.
```

**Acceptance:** eval set of 30 prompts: zero hallucinated advice; refusals exact-string match the spec.

### [VII.28.7] Prompt Cache Budget Enforcement
- **Ref** §28.7 · **Kind** Verify · **Mode** Execute

```text
Assert that every Claude call in this codebase includes cache_control markers matching §28.7. Add a unit test that mocks the Anthropic client and fails if a call omits cache_control.
```

**Acceptance:** test catches a non-cached new call.

---

# PART VIII — Operations & Governance

## Chapter 29 — Analytics Event Taxonomy

### [VIII.29.1] Event Naming Enforcement
- **Ref** §29.1 · **Kind** Build · **Mode** Execute

```text
ESLint rule on `track('<name>')` calls: regex `^[a-z]+_[a-z_]+_(ed|d|ing|ted)$` (past tense for outcomes). Or rule fails CI.
```

**Acceptance:** new event with bad name breaks lint.

### [VIII.29.2] Events Catalogue Package
- **Ref** §29.2 · **Kind** Build · **Mode** Execute

```text
`packages/analytics/src/events.ts`: Zod schema per event from §29.2 core catalogue. Export `track<T>(name, props)` that type-checks and validates at runtime. Forbid ad-hoc strings via ESLint.
```

**Acceptance:** calling `track('foo')` without `foo` in catalogue fails TS and lint.

### [VIII.29.3] Required Properties Middleware
- **Ref** §29.3 · **Kind** Build · **Mode** Execute

```text
Analytics client auto-attaches user_id, session_id, device_id, app_version, platform, locale, timestamp, trace_id on every event. Throw if any missing in the context.
```

**Acceptance:** missing trace_id in tests throws explicitly.

### [VIII.29.4] Analytics Governance Workflow
- **Ref** §29.4 · **Kind** Build · **Mode** Execute

```text
Monthly cron job queries PostHog for events with 0 volume in 60d; opens GitHub issue to remove them. PR template forces "New event?" checkbox + link to the Zod addition.
```

**Acceptance:** synthetic unused-event triggers the issue.

---

## Chapter 30 — Data Governance & Privacy

### [VIII.30.1] Retention Schedule Enforcement
- **Ref** §30.1 · **Kind** Build · **Mode** Execute

```text
`apps/api/src/cron/retention-sweeper.ts` runs nightly per entity from §30.1. Idempotent. Dry-run flag. Metrics: rows purged/entity.
```

**Acceptance:** integration test seeds stale data, cron deletes it correctly, audit entry recorded.

### [VIII.30.2] UserDeletedEvent Propagation
- **Ref** §30.2 · **Kind** Build · **Mode** Plan-first · **Depends on** [IV.18.1.9]

```text
Implement subscribers in every module listed in §30.2 flow. Each anonymises its context. After 30d grace, a hard-purge cron removes remaining rows. Audit log persisted to encrypted write-only store.
```

**Acceptance:** delete flow integration test: user gone everywhere; audit trail intact.

### [VIII.30.3] Data Export Job
- **Ref** §30.3 · **Kind** Build · **Mode** Execute

```text
Endpoint GET /users/me/export enqueues BullMQ job that builds zip (profile.json, trips.json, reviews.json, photos/, subscriptions.json, email summaries, SHA-256 manifest). Upload to S3 with 72h signed URL. Email user via Resend. Rate-limit: 1/user/24h.
```

**Acceptance:** end-to-end test produces a verified zip.

### [VIII.30.4] Consent Framework
- **Ref** §30.4 · **Kind** Build · **Mode** Execute

```text
`Consent` table (append-only): userId, purpose, granted, policyVersion, timestamp, ip. On analytics revoke: analytics middleware short-circuits non-essential events for that user.
```

**Acceptance:** revoking consent suppresses events within one request-cycle.

### [VIII.30.5] DPA Template
- **Ref** §30.5 · **Kind** Design · **Mode** Execute

```text
`legal/dpa-template.md` with scope, subprocessors, TOMs, data-subject rights passthrough, breach notification (<72h), audit rights (SOC 2 in lieu of on-site). Signable as-is by B2B customers.
```

**Acceptance:** reviewed by counsel comment; versioned.

### [VIII.30.6] Subprocessor Page
- **Ref** §30.6 · **Kind** Build · **Mode** Execute

```text
Public page /legal/subprocessors rendered from `legal/subprocessors.yaml`. Webhook notifies customers on change. Yaml has fields: name, purpose, data categories, region, certifications.
```

**Acceptance:** changing the yaml triggers an email to registered B2B customers in staging.

---

## Chapter 31 — Disaster Recovery & Incident Response

### [VIII.31.1] RPO/RTO Targets
- **Ref** §31.1 · **Kind** Design · **Mode** Execute

```text
Write `docs/dr/rpo-rto.md` listing every scenario from §31.1 with owner, test frequency, current status. Quarterly DR drill scheduled in calendar.
```

**Acceptance:** every row has an owner.

### [VIII.31.2] Backup Strategy
- **Ref** §31.2 · **Kind** Build · **Mode** Plan-first

```text
Enable Supabase PITR. Nightly logical dump to Backblaze B2, encrypted with `age` (key in 1Password). R2 bucket versioning + nightly cross-provider replication. Weekly Doppler snapshot. Document restore runbook.
```

**Acceptance:** restore test on a staging DB completes in < 30min and matches production within the RPO window.

### [VIII.31.3] Severity Matrix
- **Ref** §31.3 · **Kind** Design · **Mode** Execute

```text
`docs/incident/severity.md` + PagerDuty escalation policy reflecting §31.3 response times. On-call rota documented.
```

**Acceptance:** synthetic Sev 1 pages within 15 min.

### [VIII.31.4] Runbooks Authoring
- **Ref** §31.4 · **Kind** Build · **Mode** Execute

```text
Author each runbook from §31.4 as a single-page markdown in `docs/runbooks/`. Each follows the template: Symptom, Impact, First-5-minutes, Diagnosis, Mitigation, Post-incident actions.
```

**Acceptance:** all 8 runbooks present.

### [VIII.31.5] Postmortem Template
- **Ref** §31.5 · **Kind** Build · **Mode** Execute

```text
`docs/postmortems/TEMPLATE.md` matching §31.5 format. GitHub Actions: filing an Incident issue auto-creates a PM draft from template.
```

**Acceptance:** closing a Sev 1–2 issue without a PM linked fails a gate.

---

# PART IX — DevOps

## Chapter 32 — Local Development

### [IX.32.1] One-Command Setup
- **Ref** §32.1 · **Kind** Verify · **Mode** Execute

```text
Running `pnpm i && docker compose up -d && pnpm db:migrate && pnpm dev` on a clean machine brings api + web + mobile + admin up. Document prerequisites (Node 22, pnpm 9, Docker Desktop).
```

**Acceptance:** smoke test on a fresh Windows/Mac clone passes < 10 min.

### [IX.32.2] Docker Compose Stack
- **Ref** §32.2 · **Kind** Build · **Mode** Execute

```text
`infra/docker-compose.yml` runs: postgres:16 with PostGIS + pgvector init script, redis:7, getmeili/meilisearch, minio, axllent/mailpit, jaegertracing/all-in-one, prometheus, grafana. Health checks on each. Startup time < 60s.
```

**Acceptance:** `docker compose ps` shows all services healthy within 60s.

### [IX.32.3] Makefile Targets
- **Ref** §32.3 · **Kind** Build · **Mode** Execute

```text
Makefile with: up, down, logs, reset, db-shell, redis-shell, nuke (reset volumes + rebuild), seed-demo.
```

**Acceptance:** every target works from clean clone.

### [IX.32.4] Environment Variable Policy
- **Ref** §32.4 · **Kind** Build · **Mode** Execute

```text
`.env.example` has every env var from [III.11.1]. Local `.env.local` gitignored. `docs/env.md` documents the purpose of each variable and its owner (module).
```

**Acceptance:** new env var missing from `.env.example` fails CI check.

---

## Chapter 33 — CI/CD

### [IX.33.1] Workflow Matrix
- **Ref** §33.1 · **Kind** Verify · **Mode** Execute

```text
Confirm the 5 workflows (ci, security, cd, preview, release) from [IV.18.1.11] are all green on main. Add badges to README.
```

**Acceptance:** main branch shows all green badges.

### [IX.33.2] Turbo Remote Cache
- **Ref** §33.2 · **Kind** Build · **Mode** Execute

```text
Enable Turborepo remote cache (Vercel Remote Cache on free tier) for GitHub Actions. Report cache hit rate in the job summary.
```

**Acceptance:** second consecutive PR run reports > 50% cache hits.

### [IX.33.3] Environment Promotion
- **Ref** §33.3 · **Kind** Build · **Mode** Execute

```text
local → preview (per-PR) → staging (main) → production (tag). `prisma migrate deploy` in a pre-deploy job with shadow DB diff check. Block migration with breaking column drops unless an ADR is attached.
```

**Acceptance:** breaking migration without ADR fails gate.

---

## Chapter 34 — Deployment

### [IX.34.1] Distroless Dockerfiles
- **Ref** §34.1 · **Kind** Build · **Mode** Execute

```text
Multi-stage Dockerfile per app (api, web, admin, ai-service, media-service, notification-worker, crawler-worker). Final image = distroless, non-root. Image size target: api < 250MB, ai-service < 1.5GB.
```

**Acceptance:** `docker images` shows sizes within target.

### [IX.34.2] Hosting Topology
- **Ref** §34.2 · **Kind** Build · **Mode** Execute

```text
Fly.io: api, ai-service, workers. Vercel: web, admin. EAS: mobile. Supabase: DB. Upstash: Redis. Document in `docs/hosting.md` with regions and failover notes.
```

**Acceptance:** `fly status`, Vercel dashboard, EAS project all reachable.

### [IX.34.3] Kubernetes Migration Gate
- **Ref** §34.3 · **Kind** Design · **Mode** Execute

```text
Write `docs/adr/ADR-011-k8s-migration.md` stating the quantitative triggers to move off Fly.io (MAU, regions, GPU pools). Helm charts in `/infra/k8s/` skeleton-ready; mark unused until trigger hit.
```

**Acceptance:** ADR committed; `infra/k8s/` has Helm chart scaffolds for every service.

---

# PART X — Roadmap & Delivery

## Chapter 35 — Phased Roadmap

### [X.35.0] Roadmap Canonicalisation
- **Ref** §35 · **Kind** Design · **Mode** Execute

```text
Publish `docs/roadmap.md` with the §35 table + a per-phase list of prompt IDs + expected start/end dates based on team shape from [IV.16.3]. Weekly check-in updates it.
```

**Acceptance:** roadmap current as of last Monday.

---

## Chapter 36 — Risks & Mitigations

### [X.36.0] Risk Register
- **Ref** §36 · **Kind** Design · **Mode** Execute

```text
`docs/risks.md` with every row from §36 plus owner, probability (low/med/high), impact (low/med/high), status (open/mitigating/closed), next-review-date. Reviewed monthly.
```

**Acceptance:** every open risk has an owner + review date.

---

## Chapter 37 — Immediate Next Steps (First 2 Weeks)

### [X.37.0] Sprint Zero
- **Ref** §37 · **Kind** Build · **Mode** Plan-first

```text
Treat §37 as the Week 1–2 sprint. Create 8 prompts in GitHub issues, one per item, linking to this archive. Assign owners. Daily standup in `docs/standups/<date>.md`.
```

**Acceptance:** 8 issues created, assigned, progress visible.

---

## Chapter 38 — Verification Plan

### [X.38.1] Per-PR Gate
- **Ref** §38.1 · **Kind** Build · **Mode** Execute

```text
Required checks on main branch protection: lint, typecheck, unit, integration, security, preview. No bypass except by emergency-break label that auto-opens a follow-up issue.
```

**Acceptance:** branch protection matches spec.

### [X.38.2] Per-Phase Acceptance
- **Ref** §38.2 · **Kind** Verify · **Mode** Plan-first

```text
At each phase boundary, run: Maestro + Playwright E2E, k6 load @ 10× projected RPS, OWASP ASVS L1 checklist, closed-beta with 50–200 users, manual trip test in a target city. Green-light gate required.
```

**Acceptance:** phase close cannot be signed off without evidence in `docs/phases/<n>/closure.md`.

### [X.38.3] Pre-Launch
- **Ref** §38.3 · **Kind** Verify · **Mode** Plan-first

```text
Third-party pen test (API + mobile). DPIA sign-off. Store review materials (App Store + Play Store) prepared. Legal review of ToS + Privacy Policy.
```

**Acceptance:** all artefacts stored in `docs/launch/`.

### [X.38.4] Post-Launch
- **Ref** §38.4 · **Kind** Verify · **Mode** Execute

```text
SLO dashboards monitored. Weekly error-budget review (cal-invite). Monthly chaos test (from [III.14.6]). Quarterly DR drill (from [VIII.31.1]).
```

**Acceptance:** cadence rituals scheduled in the team calendar.

---

## Chapter 39 — What To Do Next (Action Menu)

### [X.39.0] Kick-Off
- **Ref** §39 · **Kind** Ask · **Mode** Ask

```text
Present the §39 menu to the user. Recommend:
  1. Start with [II.10.0] (Monorepo Scaffold) after CLAUDE.md is in place.
  2. Run Phase 0 prompts in DAG order (see [VI.25]).
  3. Hold a Phase 0 retro before opening any Phase 1 prompt.
Wait for user direction. Do not execute further.
```

**Acceptance:** user picks a starting prompt ID.

---

# Appendices

## Appendix A — Glossary Usage
### [A.A.0] Glossary as a Tooltip Source
- **Ref** App A · **Kind** Build · **Mode** Execute

```text
Import the Glossary table into `packages/ui/src/glossary.ts` so any web/admin UI can render term tooltips. Automate: a pre-commit hook fails if a new acronym appears in docs but isn't in the glossary.
```

**Acceptance:** pre-commit catches an unknown acronym.

## Appendix B — Reference Stack
### [A.B.0] Stack Inventory Assertion Test
- **Ref** App B · **Kind** Verify · **Mode** Execute

```text
Test `tests/stack-integrity.spec.ts`: reads every package.json; asserts presence and version-range of every dep in Appendix B. Fails if a listed dep is missing or a forbidden one is added.
```

**Acceptance:** test green with current tree; intentionally removing `@nestjs/bullmq` fails it.

## Appendix C — Document Mapping
### [A.C.0] Traceability Matrix
- **Ref** App C · **Kind** Build · **Mode** Execute

```text
Generate `docs/traceability.md` — for every file in `docs/`, `packages/`, `apps/`, link back to the originating Playbook section and the prompt ID that produced it. Updated by the end-of-session hook from [IV.19.3].
```

**Acceptance:** new file added without traceability entry fails CI.

---

*End of Prompt Archive.*
