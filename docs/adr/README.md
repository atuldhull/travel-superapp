# Architecture Decision Records

Format: [MADR](https://adr.github.io/madr/). Numbered, immutable.
An ADR is never edited in place once accepted — supersede with a new one instead.

## Index

| #   | Title                                                                               | Status   | Prompt     |
| --- | ----------------------------------------------------------------------------------- | -------- | ---------- |
| 001 | [Modular monolith with selective service extraction](./ADR-001-modular-monolith.md) | Accepted | `[II.6.2]` |
| 002 | [Service-extraction triggers](./ADR-002-service-extraction-triggers.md)             | Accepted | `[II.6.3]` |
| 003 | [Event backbone — Redis Streams first](./ADR-003-event-backbone.md)                 | Accepted | `[II.6.4]` |

## Authoring

Copy an existing ADR, bump the number, keep the sections:

1. **Context** — what problem are we solving, what forces act on the decision.
2. **Decision Drivers** — the constraints that shape the choice.
3. **Considered Options** — alternatives, named.
4. **Decision Outcome** — the chosen option + why.
5. **Consequences** — positive + negative, including what tooling/process this binds us to.
6. **Links** — Playbook section, related prompts, external refs.

Never delete an ADR. If a decision flips, add a new one that supersedes the previous (and update the `Status` line of the old one to `Superseded by ADR-NNN`).
