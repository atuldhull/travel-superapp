# CLAUDE.md — System Rules for TravelSuperApp

> This file is auto-loaded by Claude Code at the start of every session in this repository. Every AI agent working on this codebase (Claude Code, Cursor, Aider, Copilot) must obey the rules below.
>
> **Source of truth:** [`travel-app-playbook.md`](./travel-app-playbook.md) (the book) and [`travel-app-prompts.md`](./travel-app-prompts.md) (one prompt per Playbook subsection).
>
> **Enforcement:** this file was installed by prompt `[IV.19.1]`. Changes require a new ADR.

---

## Project

Mobile-first, AI-powered travel super-app. A user enters a place + radius; the app generates a full itinerary (places, stays, food, events, transport fit, timing, crowd, safety, weather, prices, language, scams, 3D previews, photo spots) and stays with them through the trip with live re-planning.

**Stack:** Turborepo + pnpm · NestJS 11 (Fastify) + Next.js 15 + React Native (Expo 51) + Prisma 5 / Postgres 16 (PostGIS + pgvector) + Redis 7 + Python FastAPI ai-service.

**Architecture:** clean / hexagonal architecture in every NestJS module. Modular monolith with four extracted services (ai, media, notification, crawler).

---

## Authoritative Docs

| File                                                                                 | Role                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `travel-app-playbook.md`                                                             | **The book.** Every architectural decision lives here.                                           |
| `travel-app-playbook.html`                                                           | Shareable viewer of the book.                                                                    |
| `travel-app-prompts.md`                                                              | Prompt archive — one prompt per Playbook subsection. You are executing one of these per session. |
| `travel-app-plan.md` / `travel-app-compendium-v2.md` / `travel-app-compendium-v3.md` | Historical context (preserved; not authoritative).                                               |
| `PROGRESS.md`                                                                        | Rolling log of completed prompts. Updated at the end of every session.                           |
| `docs/agent-contract.md`                                                             | Acknowledgements any AI agent makes during sessions (seed prompts write here).                   |
| `docs/adr/`                                                                          | Architecture Decision Records (MADR format).                                                     |
| `docs/blocks/<prompt-id>/`                                                           | Per-prompt artefacts: spec, draft, diff, test-output, verification, retrospective.               |
| `docs/runbooks/`                                                                     | Oncall + operational playbooks.                                                                  |

---

## Hard Constraints (never violate)

1. **Scope-lock:** modify only files in the current prompt's "Files to touch" list.
2. **Dependency-lock:** add only dependencies explicitly listed in the prompt.
3. **No silent deletes:** never delete a file you did not create in this session.
4. **No surprise commits:** never commit unless the user says "commit this" (or the execution workflow for this project explicitly commits per-prompt — see PROGRESS.md workflow).
5. **No secrets:** never write real API keys / credentials — use `REPLACE_ME_SEE_DOPPLER`.
6. **No AC skipping:** never skip the prompt's Acceptance Criteria check.
7. **No auto-advance:** never move to the next prompt without user confirmation.
8. **Prisma schema is append-only** unless the prompt explicitly permits edits.
9. **No `any` types.** No `console.log` — use `@app/logger`.
10. **Clean/hex dependency rule:** `domain ← application ← infrastructure/interface`. Never inverted.
11. **PostGIS rule:** never call `prisma.place.create({ data: { coordinates: ... } })` — always go through `GeoQueries`.
12. **Token storage rule:** never store tokens in `localStorage`. Access tokens live in memory; refresh tokens live only in httpOnly cookies.
13. **Transaction rule:** never wrap network calls inside `prisma.$transaction`.

---

## Output Format (end every session with this block)

```
FILES CREATED: <list>
FILES EDITED:  <list>
DEPS ADDED:    <name@version>
COMMANDS:      <numbered run list>
VERIFICATION:  <paste output>
NEXT PROMPT:   <id> — <one-line context to carry>
```

---

## Self-Check Before Declaring DONE

- [ ] `pnpm turbo run typecheck` green for touched packages.
- [ ] `pnpm turbo run lint` green for touched packages.
- [ ] Coverage threshold met (domain ≥ 80%, application ≥ 80% on modules).
- [ ] No `// TODO` left that wasn't in the spec.
- [ ] Acceptance criteria verified.
- [ ] `PROGRESS.md` updated.

---

## Escalation (BLOCKED Report)

When stuck, produce:

- **What I tried.**
- **What failed** (paste the exact error).
- **What I need** to unblock.
- **Do NOT guess or proceed.**

---

## Tool Hints (Claude Code specific)

- Use `/plan` mode before any multi-file build prompt.
- Use `Agent` tool with subagent `Explore` for codebase research spanning > 3 greps.
- Use `Agent` tool with subagent `Plan` for architecture-heavy prompts.
- Use `TodoWrite` to track subtasks inside one prompt.
- Use `Skill` tool (built-ins: `simplify`, `review`, `security-review`, `init`) where appropriate.
- Prompt caching: place the Prisma schema, shared-types, and error catalog in Anthropic cache layer 2 (1h TTL).

---

## Execution Workflow (this project)

1. **One prompt per session.** Session starts by stating the prompt ID (e.g. `Running prompt [IV.19.1]`).
2. **Read the Playbook section** the prompt references before touching code.
3. **Plan** (in `/plan` mode or via the `Plan` subagent) for anything non-trivial.
4. **Execute** with the files/dependencies listed in the prompt — nothing more.
5. **Test** — for code prompts, run typecheck + lint + the relevant test suite before committing.
6. **Commit** with message format: `<type>(<prompt-id>): <short-summary>` — conventional commits with the prompt id in the scope. `<type>` is one of `feat | fix | docs | chore | refactor | test | build | ci | perf | style | revert`. Example: `chore(II.10.0): scaffold monorepo`, `feat(III.11.1): build @app/config package`. Enforced by `commitlint.config.js`.
7. **Update `PROGRESS.md`** — append a row for this prompt.
8. **Report + ask to proceed.** Never auto-continue.

---

_Installed by `[IV.19.1]`. See `travel-app-prompts.md` for the full archive._
