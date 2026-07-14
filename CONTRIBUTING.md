# Contributing to TravelSuperApp

> Companion to [`docs/onboarding.md`](./docs/onboarding.md) (day-1 setup).

Welcome — and thank you for considering a contribution. This repo is the engineering backbone of an AI-powered travel super-app: a NestJS modular monolith + Next.js 15 web + Expo 51 mobile + a Python ai-service, glued by Turborepo + pnpm. The bar is high but the rules are explicit; once you know them, contributing is fast.

## Table of contents

- [Quick start](#quick-start)
- [Branch + commit conventions](#branch--commit-conventions)
- [Pull-request checklist](#pull-request-checklist)
- [Code-review checklist (for reviewers)](#code-review-checklist-for-reviewers)
- [Architecture rules you must respect](#architecture-rules-you-must-respect)
- [How to file a bug / feature / security issue](#how-to-file-a-bug--feature--security-issue)
- [Where docs live](#where-docs-live)

## Quick start

Five commands from a fresh clone to a green PR:

```sh
git clone <repo-url> travel-superapp
cd travel-superapp
pnpm install
pnpm dev:up:verify     # docker stack + migrate + seed + /health/ready=200 proof
pnpm typecheck && pnpm lint && pnpm arch && pnpm cycles && pnpm cover:unit
```

If any of those fail before you touch anything, **stop and ask** in the issue tracker — `main` should always be green. Don't fix unrelated breakage in your PR; that's its own change.

Full setup steps: [`docs/onboarding.md`](./docs/onboarding.md).

## Branch + commit conventions

### Branches

Branch from `main`. Name your branch `<type>/<short-slug>` (e.g. `feat/trip-publish-ttl`, `fix/oauth-redirect-loop`). No spaces, no caps, no ticket numbers in the branch name.

### Commits

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <subject ≤ 100 chars>

<body — wrap at 100, list bullet points freely, include "Why:" and "How to apply:" when relevant>
```

Allowed types: `feat | fix | docs | chore | refactor | test | build | ci | perf | style | revert`. The commit hook ([`commitlint.config.js`](./commitlint.config.js)) enforces this; PRs with a non-conforming subject get blocked.

**One commit per slice.** Don't bundle "fix this + add that + also rename" into one commit — separate them. A slice is "the smallest thing a reviewer can sensibly evaluate in isolation".

**Heredoc, not backticks.** Use `git commit -F-` with a `<<'EOF'` heredoc when the message has backticks or `$` in it — bash command substitution will eat them otherwise.

### Examples

```text
feat(P1): C4 architecture diagrams (system context + containers + components-api)

fix(P4): ignore generated data-model.md in prettier so the drift gate converges

docs(P7): CHANGELOG.md + release-please automation
```

## Pull-request checklist

The PR template (auto-loaded when you open a PR) covers this in detail. The short version, in order:

1. **CI is green** locally before you push — typecheck, lint, arch, cycles, cover:unit, fitness specs.
2. **CHANGELOG.md** does NOT need a manual entry — release-please reads Conventional Commits.
3. **ADR** in `docs/adr/` if the change flips an architectural rule. Use [MADR](https://adr.github.io/madr/) format.
4. **No secrets** in the diff. Search the diff for `sk_live`, `hcaik_`, `xkeysib_`, `xoxb-`, etc.
5. **No `any` types** in TypeScript. No `console.log` — use `@app/logger`.
6. **Tightly scoped** — if you discovered a real bug nearby, open a separate PR.
7. **Drafted as a draft PR** until you've self-reviewed the diff (use GitHub's "View files changed" tab). Convert to "Ready for review" only when you'd merge it yourself.

## Code-review checklist (for reviewers)

When you're reviewing someone else's PR, walk this list before approving:

### Architecture

- [ ] **Hex layering preserved.** `domain ← application ← {infrastructure, interface}`. Use-cases don't import Prisma; controllers don't import use-case internals. (`pnpm arch` should catch this.)
- [ ] **Bounded contexts respected.** Sibling modules import each other's `interface/facade/`, never `application/` or `infrastructure/`. (`pnpm cycles` catches the worst cases; reviewer eye catches the subtle ones.)
- [ ] **Three sanctioned forwardRef cycles only** (`trip↔{food,media,safety}`). New cycles fail CI; if you see a `forwardRef` in the diff, it had better already be in `ALLOWED_FORWARD_REF_CYCLES`.
- [ ] **No new barrel re-export of `<M>Module`** in `<m>/index.ts`. Cross-module DI uses direct `'<m>/<m>.module'` import.

### Data + integration

- [ ] **Prisma migrations are additive.** `prisma migrate dev` is forbidden in PRs — hand-curate every migration to be `ALTER` / `CREATE`, never `DROP` (`DROP` re-creates PostGIS/pgvector indexes and we lose them).
- [ ] **PostGIS goes through `GeoQueries`**, not raw `prisma.place.create({ coordinates })`.
- [ ] **External calls wrapped** in `@app/resilience` (`callExternal` + `CircuitBreaker`). New unwrapped external adapter? The fitness gate fails CI but the reviewer is the second line of defence.
- [ ] **OpenAPI spec regenerated** if a controller / DTO changed — `pnpm sdk:check` fails the PR otherwise.

### Tests

- [ ] **Coverage holds** — domain ≥ 80%, application ≥ 80% per module, mutation ≥ 80% global (Stryker, with `StringLiteral` + `ObjectLiteral` excluded).
- [ ] **New invariants in fitness specs** for new rules. If the PR introduces a "don't ever do X" pattern, lock it in [`apps/api/test/architecture.fitness.spec.ts`](./apps/api/test/architecture.fitness.spec.ts).
- [ ] **No `if (!dbReachable) return` skip-pass** in new specs. The L2 codemod swept them; new ones are a regression. (Caught by jest pattern, but reviewer eye is faster.)
- [ ] **No `console.log` in tests.** Use `expect` for assertions; structured logger via `@app/logger` if you really need output.

### Style + safety

- [ ] **Conventional Commits subject ≤ 100 chars.** Body wraps at 100.
- [ ] **No `any`** anywhere. `unknown` + type-narrow if you genuinely don't know.
- [ ] **No secrets** — search the diff for `_KEY`, `_SECRET`, `_TOKEN` patterns. Use `REPLACE_ME_SEE_DOPPLER` in `.env.example`.
- [ ] **Localhost = 127.0.0.1** in dev configs.
- [ ] **Token storage** — never `localStorage`. Access in memory, refresh in httpOnly cookie.

### Docs

- [ ] **README + onboarding still accurate** for setup steps the PR changed.
- [ ] **CHANGELOG** does NOT need a manual entry (release-please).
- [ ] **ADR** added if an architectural rule flipped.

Approve only when every box is ticked or has an explicit "doesn't apply because Y" comment.

## Architecture rules you must respect

Non-negotiable, and enforced by `pnpm arch` / `pnpm lint` / review:

1. **No secrets** — never write real keys; use the `REPLACE_ME_SEE_DOPPLER` sentinel.
2. **Prisma schema is append-only.** Migrations that touch geo/vector models are hand-curated — `prisma migrate dev` re-proposes dropping the PostGIS/pgvector indexes it can't see.
3. **No `any` types. No `console.log` — use `@app/logger`.**
4. **Clean / hex dependency rule** — `domain ← application ← infrastructure/interface`. Never inverted.
5. **PostGIS rule** — never call `prisma.place.create({ data: { coordinates: ... } })` — always `GeoQueries`.
6. **Token storage** — never `localStorage`. Access in memory; refresh in httpOnly cookie.
7. **Transaction rule** — never wrap network calls inside `prisma.$transaction`.

## How to file a bug / feature / security issue

Issue templates live at [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) — when you click "New issue" GitHub offers a chooser:

- **🐛 Bug report** — something is broken in `main` (or in a release). Reproduction + expected vs actual + the relevant log line / stack trace.
- **✨ Feature request** — a new capability. Problem statement first, solution sketch second; we evaluate proposals against the playbook + product roadmap.
- **🔒 Security disclosure** — **don't file in public**. Email `security@travel.local` instead. The template just points you there; we'll bring the conversation into a private security advisory on GitHub. See [`SECURITY.md`](./SECURITY.md).

For docs-only fixes (typo, broken link, stale runbook), feel free to open a PR directly — no issue needed.

## Where docs live

- **`README.md`** — top-level entry point; quickstart + structure + canonical doc pointers.
- **`docs/onboarding.md`** — day-1 setup.
- **`docs/architecture/`** — visual architecture (C4), bounded-context map, generated ERD.
- **`docs/adr/`** — every architectural decision, MADR format.
- **`docs/runbooks/`** — operational playbooks (one per failure mode).
- **`docs/api/`** — generated OpenAPI spec + Redoc viewer.
- **`docs/security/threat-model.md`** — STRIDE per trust boundary.
- **`docs/compliance/gdpr-audit.md`** — Art. 6 / 15-21 coverage.
- **`CHANGELOG.md`** — public release notes, maintained by release-please.

If you find any of those out of date — fix it in the same PR as the feature that drifted it. New-engineer feedback IS the canonical signal that onboarding has drifted.

## License

Proprietary — all rights reserved. By contributing, you agree your contributions are licensed on the same terms.
