# C4 Architecture Diagrams

> Visual companion to [`docs/architecture/context-map.md`](../context-map.md) (the source-of-truth bounded-context table) and the [ADR series](../../adr/). Diagrams are rendered with [Mermaid C4](https://mermaid.js.org/syntax/c4.html), which GitHub renders natively — no build step, no exported PNGs to keep in sync.
>
> **Installed by** `[P1]` of the Documentation 8.5→10 series.

---

## The C4 model in one paragraph

[C4](https://c4model.com/) is a four-level zoom on a system:

1. **Context** — the system as one box, surrounded by the people and external systems it talks to. Answers "what problem does this thing solve, and who plugs into it?".
2. **Container** — break the system into independently-deployable units (apps, services, datastores). Answers "what runs where, and how do those units talk to each other?".
3. **Component** — break one container into its internal modules and the ports between them. Answers "inside `apps/api`, what are the parts?".
4. **Code** — class / file detail. **We deliberately stop at L3** — code-level diagrams rot faster than code does. The TypeScript types + the [bounded-context table](../context-map.md) carry that level.

Each level adds detail without contradicting the level above. If a name appears on L2 it must also appear on L1 (folded into the system box).

---

## Index

| Level                     | File                                       | Audience                                                              | What it answers                                                          |
| ------------------------- | ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **L1 — Context**          | [`system-context.md`](./system-context.md) | Anyone (PM, sales, exec, new hire on day 1)                           | "Where does TravelSuperApp sit in the world it lives in?"                |
| **L2 — Containers**       | [`containers.md`](./containers.md)         | Engineers in week 1; oncall reading runbooks                          | "What ships? Where does a request actually go?"                          |
| **L3 — Components (api)** | [`components-api.md`](./components-api.md) | Engineers touching `apps/api`; reviewers gating a cross-module change | "Which bounded context owns this code path, and what does it depend on?" |

The three files are mutually consistent. If you edit one, walk up and down to check the others still hold.

---

## When to update these diagrams

- A **new external SaaS** integration → L1 + L2 (plus a new entry in [`docs/external-apis.md`](../../external-apis.md)).
- A **new app or worker** in `apps/` → L2 (plus a new row in the root [`README.md`](../../../README.md#structure)).
- A **new bounded context** (rare — requires an ADR) → L3 + a new row in [`context-map.md`](../context-map.md).
- A **renamed module** (`identity` → `account`, etc.) → grep all three files; CI does not enforce diagram drift today (a future docs-lint rule could).

---

## How to read a Mermaid C4 diagram

```text
Person(alias, "Label", "Short description")          → human actor (left-most blob)
System(alias, "Label", "Short description")          → the system in scope
System_Ext(alias, "Label", "…")                      → an external system you depend on
SystemDb(alias, "Label", "…")                        → an external datastore
SystemQueue(alias, "Label", "…")                     → an external message broker
Container(alias, "Label", "Tech", "Description")     → a deployable unit (app / worker / db)
Component(alias, "Label", "Tech", "Description")     → an internal module
Rel(from, to, "Label", "Tech")                       → directed dependency, optional protocol
BiRel(a, b, "Label", "Tech")                         → bidirectional (request + reply pair)
Boundary(alias, "Label") { … }                       → grouping (cluster, AZ, trust zone)
```

GitHub renders these as SVG inline. To preview locally:

````bash
# One-off: render to PNG with mermaid-cli
npx -y @mermaid-js/mermaid-cli -i docs/architecture/c4/containers.md -o /tmp/c4.svg
# Or: paste a fenced ```mermaid block into https://mermaid.live
````

---

## Conventions used across the three files

- **Aliases are kebab-case** (`trip-planner`, not `TripPlanner`) so they read the same in source and in rendered output.
- **External systems are pinned to the right** by listing them last in each diagram (Mermaid lays out roughly in declaration order).
- **Tech tags** on `Container(…)` use the exact stack name we deploy — `NestJS 11 (Fastify)` not "Node backend".
- **Free-tier or local-only services** (Mailpit, MinIO, Jaeger, Ollama) are explicitly tagged so the reader can tell what we pay for vs. what runs in `infra/docker-compose.yml`.
- **The 17 bounded contexts** in L3 cluster into 7 visual groups by responsibility (Identity, Trip, Place-Discovery, Safety, Social-&-Memory, Money, Platform-Ops). The clustering is rendering-only — the canonical 17-row list lives in [`context-map.md`](../context-map.md).

---

## See also

- [`docs/architecture/context-map.md`](../context-map.md) — the 17-context table (model ownership, inbound / outbound events, facade ports)
- [`docs/adr/`](../../adr/) — the architecture decisions these diagrams visualise
- [`docs/external-apis.md`](../../external-apis.md) — every external dependency with free-tier limits + fallback chain
- [`docs/runbooks/`](../../runbooks/) — operational playbooks per failure mode
