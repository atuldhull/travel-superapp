<!--
Prompt-driven PR. See travel-app-prompts.md for the archive,
CONTRIBUTING.md for the full reviewer checklist, and CLAUDE.md for the
hard constraints. Tightened by [P8].
-->

## Context

- **Prompt ID:**
- **Playbook §:**
- **Depends on:**

## Summary

<!-- 1–3 sentences on what this PR changes and why. -->

## Changes

<!-- Bullet list of concrete changes. Group by package / module if it spans many. -->

-

## Acceptance criteria (from prompt)

<!-- Copy the prompt's acceptance list and tick each as verified. -->

- [ ]

## Verification

<!-- Paste typecheck / lint / test output. Screenshots for UI. -->

```text

```

## Risk & rollback

<!-- What can break? How to revert (revert this commit? toggle feature flag? rotate a secret?). -->

---

## Author checklist (tick before requesting review)

- [ ] `CLAUDE.md` hard constraints respected (scope-lock, no silent deletes, no secrets, no `any`).
- [ ] One commit per slice — heredoc commit messages, no backticks in subject, ≤ 100 chars.
- [ ] Local gauntlet green: `pnpm typecheck && pnpm lint && pnpm arch && pnpm cycles && pnpm cover:unit`.
- [ ] `pnpm sdk:check` green if a controller / DTO changed.
- [ ] `pnpm docs:erd:check` green if `apps/api/prisma/schema.prisma` changed.
- [ ] `pnpm docs:env:check` green if `packages/config/src/schema.ts` changed.
- [ ] `PROGRESS.md` updated for prompt-driven changes.
- [ ] ADR filed under `docs/adr/` if an architectural rule flipped.
- [ ] No new dependencies — or each is justified inline.
- [ ] No `console.log`; structured logging via `@app/logger`.

## Reviewer checklist

(See [CONTRIBUTING.md §Code-review checklist](../CONTRIBUTING.md#code-review-checklist-for-reviewers) for the canonical list.)

**Architecture**

- [ ] Hex layering preserved (`domain ← application ← {infra, interface}`).
- [ ] Sibling modules import each other's `interface/facade/`, never `application/` or `infrastructure/`.
- [ ] No new `forwardRef` cycle outside `ALLOWED_FORWARD_REF_CYCLES`.
- [ ] No new `<M>Module` re-export from `<m>/index.ts`.

**Data + integration**

- [ ] Prisma migrations are additive (no `DROP`); deployed via `migrate deploy`.
- [ ] PostGIS goes through `GeoQueries`, pgvector through `VectorQueries`.
- [ ] External calls wrapped in `@app/resilience` (`callExternal` + `CircuitBreaker`).
- [ ] OpenAPI regenerated if a controller / DTO changed.

**Tests**

- [ ] Coverage holds — domain ≥ 80%, application ≥ 80% per module, mutation ≥ 80% global.
- [ ] New invariant locked in `apps/api/test/architecture.fitness.spec.ts` if a new rule is added.
- [ ] No `if (!dbReachable) return` skip-pass in new specs.
- [ ] No `console.log` in tests.

**Safety**

- [ ] No secrets in the diff (`_KEY`, `_SECRET`, `_TOKEN` patterns).
- [ ] `localhost` written as `127.0.0.1` in dev configs.
- [ ] Tokens: access in memory, refresh in httpOnly cookie. Never `localStorage`.
