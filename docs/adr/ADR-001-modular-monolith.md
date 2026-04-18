# ADR-001 — Modular monolith with selective service extraction

- **Status:** Accepted
- **Date:** 2026-04-18
- **Prompt:** `[II.6.2]`
- **Playbook reference:** §6.2

## Context

TravelSuperApp has ~17 bounded contexts (Identity, Trip, Places, Stays, Safety, Weather, Translation, etc.) and needs to ship an MVP fast. We're pre-PMF with a very small team (1–3 engineers). The contexts have real domain boundaries; pretending they don't would cause a big-ball-of-mud. Treating each as its own microservice from day one would cost months of infra yak-shaving before the first user-visible feature lands.

## Decision drivers

- **Speed to first user.** Every week spent on service mesh / cross-service auth / distributed tracing before the product exists is a week users aren't touching anything.
- **Boundary preservation.** The 17 contexts are real; we need code-level enforcement that they don't bleed into each other.
- **Operational complexity.** One Node process is dramatically easier to debug, deploy, and observe than 17.
- **Future optionality.** We WILL split some services out later (ML workloads, image processing, queue workers); the architecture must make that a refactor, not a rewrite.

## Considered options

1. **Pure microservices from day one.** Each bounded context is its own deployable.
2. **Modular monolith.** One NestJS process with clean-hex modules that enforce boundaries via ESLint `import/no-restricted-paths`, cross-context communication via domain events only.
3. **Serverless functions per feature.** Each handler deployed independently.

## Decision outcome

**Chose option 2 — modular monolith.** One `apps/api` NestJS process hosts all 17 bounded contexts. Only four services are extracted from day one, chosen by necessity (see ADR-002):

- `ai-service` (Python — native ML stack)
- `media-service` (Node worker — CPU-bound image/video)
- `notification-worker` (queue consumer — scale independently)
- `crawler-worker` (Playwright + cron — separate lifecycle)

Everything else ships inside `apps/api`.

### Positive consequences

- Single deploy, single log stream, single DB connection pool for the common case.
- Refactors across contexts stay as simple TS edits — no wire-protocol changes.
- Testing is straightforward: spin up one process with a test env and exercise everything.
- Future extraction: swap a repository adapter from Prisma to an HTTP client — domain and application layers don't change. Clean-hex pays off here.

### Negative consequences

- A runaway bug in one context can crash the whole process. Mitigated by aggressive typing, `DomainExceptionFilter` + `AllExceptionFilter`, unit-tested use cases.
- Scaling is coarse — if one context is hot, we scale everything. Acceptable at MVP load; revisit when traffic patterns emerge (see ADR-002 triggers).
- Boundary enforcement relies on tooling, not deployment. ESLint `import/no-restricted-paths` + CI boundary checks are mandatory.

## Consequences (binding)

- Every module under `apps/api/src/modules/<context>/` MUST follow the clean-hex layout: `domain/ ← application/ ← infrastructure|interface/`.
- Cross-context communication inside the monolith is ONLY via published domain events (`@app/events`, when landed) or explicit facade ports. Direct imports across module boundaries fail lint.
- Any proposal to break this pattern requires a new ADR (superseding this one) — e.g. "bypass events for the trip↔places performance path" must be written down.

## Links

- Playbook §6.2 (Core principle), §7.1 (Optimum parts principle).
- Sibling ADRs: [ADR-002](./ADR-002-service-extraction-triggers.md), [ADR-003](./ADR-003-event-backbone.md).
- [Shopify's Majestic Monolith](https://shopify.engineering/shopify-monolith) — empirical validation of the pattern at scale.
- [Sam Newman, "Monolith to Microservices"](https://samnewman.io/books/monolith-to-microservices/) — chapters 1–2 on when not to split.
