# ADR-002 — Service-extraction triggers

- **Status:** Accepted
- **Date:** 2026-04-18
- **Prompt:** `[II.6.3]`
- **Playbook reference:** §6.3 + §7.3

## Context

[ADR-001](./ADR-001-modular-monolith.md) locks in the monolith-first posture. That ADR extracts four services from day one; this ADR documents the _triggers_ that justified those four and establishes the rule for any future extraction.

## Decision drivers

- **Avoid premature microservices.** Extracting a service that doesn't need to be extracted costs 3–5× more than keeping it inside the monolith.
- **Clear, quantitative triggers.** Not vibes — actual thresholds that any engineer can check.
- **Non-negotiable cases.** Some things simply cannot live inside Node — document them up front.

## Considered options

1. **Extract aggressively.** Anything that "feels like a service" gets its own deployable.
2. **Extract on trigger.** Require a documented, measurable reason.
3. **Never extract.** Keep everything in one process forever.

## Decision outcome

**Chose option 2 — extract on trigger.**

A bounded context SHALL be extracted into its own service only when at least one of the following is true:

### Extraction triggers (any one is sufficient)

1. **Language / runtime mismatch.** The workload cannot run efficiently (or at all) in Node.js.
   _Current example:_ `ai-service` hosts NLLB-200, Whisper, DistilBERT — none ship usable Node bindings; Python is the native stack.

2. **Radically different scaling profile.** The workload consumes 10× the CPU, memory, or network of the rest of the app under identical user load.
   _Current example:_ `media-service` — image resize + ffmpeg transcode + 3D tile caching are CPU-bound; scaling the whole monolith to absorb a single user's video upload is wasteful.

3. **Different latency contract.** The workload's SLO is fundamentally different from the rest (long-running batch vs. synchronous request).
   _Current example:_ `notification-worker` — push fan-out is queue-driven with retries and DLQ; has no HTTP endpoint; sits outside the request/response loop entirely.

4. **Independent lifecycle / blast radius.** The workload's failures must not take down the main API.
   _Current example:_ `crawler-worker` — price scraping via Playwright is flaky by nature (external sites change); isolating it means a broken scraper doesn't affect checkout.

5. **Compliance / isolation.** The workload handles a blast-radius-separate data class that must be segregated.
   _Hypothetical, not yet extracted:_ a payments service handling cardholder data at PCI-DSS scope.

### Anti-triggers (reasons NOT to extract)

- "It feels modular." → Modularity is enforced by the clean-hex boundaries inside the monolith. That's enough.
- "It has its own database schema." → A single Postgres can host many schemas.
- "It's owned by a different team." → Team boundaries ≠ deployment boundaries. Conway's Law is a risk, not a design principle.
- "We might want to scale it separately someday." → "Someday" is not a trigger. Come back when you have numbers.

### Services extracted on day one

| Service               | Trigger(s)                    | Why right now                                                        |
| --------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `ai-service`          | 1 (language)                  | Models are Python-only.                                              |
| `media-service`       | 2 (scaling)                   | ffmpeg + 3D tile generation are CPU-bound; must scale independently. |
| `notification-worker` | 3 (latency), 4 (lifecycle)    | Queue consumer; never synchronous.                                   |
| `crawler-worker`      | 4 (blast radius), 3 (latency) | Scheduled Playwright jobs; failures must not 5xx the API.            |

### Positive consequences

- New engineers can look at this ADR and immediately know whether a proposed extraction is justified.
- Reviewers can reject "let's make this its own service" PRs by citing the trigger list.

### Negative consequences

- The triggers are qualitative enough that reasonable people will disagree at the margin. Resolve by writing a new ADR that supersedes this one with sharper thresholds.

## Consequences (binding)

- **Any new service requires an ADR** that names the trigger satisfied.
- **Removing / merging a service back into the monolith** also requires an ADR (same scrutiny in the other direction).
- **Cross-service communication** is ONLY via the event bus (`@app/events`, see ADR-003) OR explicit gRPC/REST ports documented in `docs/services/<name>/contract.md`. Never by tailing another service's DB.

## Links

- Playbook §6.3, §7.3.
- Sibling: [ADR-001](./ADR-001-modular-monolith.md).
- [Martin Fowler, "MonolithFirst"](https://martinfowler.com/bliki/MonolithFirst.html) — the canonical argument for this posture.
- [Google SRE — "Distributed Systems 101"](https://sre.google/workbook/distributed-systems/) — the costs side of the trade.
