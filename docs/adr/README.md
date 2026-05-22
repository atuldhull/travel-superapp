# Architecture Decision Records

Format: [MADR](https://adr.github.io/madr/). Numbered, immutable.
An ADR is never edited in place once accepted — supersede with a new one instead.

## Index

| #   | Title                                                                                                                 | Status   | Prompt         |
| --- | --------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| 001 | [Modular monolith with selective service extraction](./ADR-001-modular-monolith.md)                                   | Accepted | `[II.6.2]`     |
| 002 | [Service-extraction triggers](./ADR-002-service-extraction-triggers.md)                                               | Accepted | `[II.6.3]`     |
| 003 | [Event backbone — Redis Streams first](./ADR-003-event-backbone.md)                                                   | Accepted | `[II.6.4]`     |
| 004 | [Bounded-context principle — no cross-module imports](./ADR-004-bounded-contexts.md)                                  | Accepted | `[II.7.1]`     |
| 005 | [Frontend stack: Next.js + Expo + TS strict + Tailwind + Tamagui](./ADR-005-frontend-stack.md)                        | Accepted | `[II.8.1]`     |
| 006 | [Backend stack: NestJS + Fastify + Prisma + FastAPI + BullMQ](./ADR-006-backend-stack.md)                             | Accepted | `[II.8.2]`     |
| 007 | [Data layer: Postgres + PostGIS + pgvector + Redis + Meilisearch](./ADR-007-data-layer.md)                            | Accepted | `[II.8.3]`     |
| 008 | [AI stack: layered Anthropic + self-hosted NLLB/Whisper/DistilBERT/Llama 3.1](./ADR-008-ai-stack.md)                  | Accepted | `[II.8.4]`     |
| 009 | [DevOps & infra: pnpm + Turborepo + Fly.io/Railway, Terraform-ready for AWS](./ADR-009-devops.md)                     | Accepted | `[II.8.6]`     |
| 010 | [Delete policy: anonymise-on-delete, no soft-delete middleware](./ADR-010-soft-delete-policy.md)                      | Accepted | `[III.12.6]`   |
| 011 | [TypedRedisCache shared base + write-invalidated subset](./ADR-011-typed-redis-cache-base.md)                         | Accepted | `[IV.18.19.7]` |
| 012 | [Owner-scoped `updateMany` + count gate as the universal write pattern](./ADR-012-owner-scoped-updatemany-pattern.md) | Accepted | `[IV.18.19.7]` |
| 013 | [Per-section graceful degradation in composite endpoints](./ADR-013-section-graceful-degradation.md)                  | Accepted | `[IV.18.19.7]` |
| 014 | [Admin endpoints live in the owning module, not AdminModule](./ADR-014-admin-in-owning-module.md)                     | Accepted | `[IV.18.19.7]` |
| 015 | [The generated orval SDK is the canonical web↔API client](./ADR-015-web-api-client-generation.md)                     | Accepted | `[A4]`         |

## Authoring

Copy an existing ADR, bump the number, keep the sections:

1. **Context** — what problem are we solving, what forces act on the decision.
2. **Decision Drivers** — the constraints that shape the choice.
3. **Considered Options** — alternatives, named.
4. **Decision Outcome** — the chosen option + why.
5. **Consequences** — positive + negative, including what tooling/process this binds us to.
6. **Links** — Playbook section, related prompts, external refs.

Never delete an ADR. If a decision flips, add a new one that supersedes the previous (and update the `Status` line of the old one to `Superseded by ADR-NNN`).
