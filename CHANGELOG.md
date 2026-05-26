# Changelog

All notable changes to TravelSuperApp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Conventional Commits with the prompt-id in scope drive the entries: `<type>(<prompt-id>): <subject>` — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`commitlint.config.js`](./commitlint.config.js).

From version 0.1.0 onward, this file is **maintained by [release-please](.github/workflows/release-please.yml)**. Direct edits below 0.1.0 are the seed retrospective covering the road-to-10 work; once 0.1.0 ships, release-please takes over and direct edits are discouraged.

## [Unreleased]

### 📚 Documentation

- **P1** — C4 architecture diagrams. Three Mermaid blocks ([`system-context`](docs/architecture/c4/system-context.md), [`containers`](docs/architecture/c4/containers.md), [`components-api`](docs/architecture/c4/components-api.md)) render natively on GitHub.
- **P2** — `pnpm dev:up:verify` boots the stack and polls `/health/ready=200` end-to-end. Gated on every PR via [`bootstrap-smoke.yml`](.github/workflows/bootstrap-smoke.yml).
- **P3** — Hosted API reference (Redoc thin shell + offline bundle) at [`docs/api/`](docs/api/). GitHub Pages workflow ships ready-to-enable.
- **P4** — Auto-emitted ERD at [`docs/architecture/data-model.md`](docs/architecture/data-model.md) — 64 models in 8 clusters. Drift gate `pnpm docs:erd:check` blocks schema-without-doc PRs.
- **P6** — Docs staleness CI: markdownlint + lychee + env-schema drift in [`docs-lint.yml`](.github/workflows/docs-lint.yml). Caught 19 real env-var drifts.
- **P7** — release-please + this CHANGELOG (you are here).
- **P8** — see next section.

## 0.0.0 (2026-05-25) — Pre-release seed

This section captures the four "road-to-10" dimensions closed before release-please took over. It is **not** a versioned release — the project has not yet shipped 0.1.0. Future versions follow Semantic Versioning + Conventional Commits.

### Architecture & structure (8.5 → 10)

- **A-series** — workspace baseline + Turborepo + pnpm + tsconfig + ESLint flat config.
- **B-series** — modular monolith scaffolding: 19 NestJS modules under `apps/api/src/modules/`, hex layering, per-module barrels.
- **C-series** — madge cycle gate; fix `<M>Module` re-export bug that bricked AppModule bootstrap.
- **D-series** — `pnpm sdk:check` drift gate (openapi.yaml ↔ controllers ↔ generated SDK).
- **E-series** — `arch` job in CI runs `pnpm arch` + `pnpm cycles` + `pnpm sdk:check`.
- **F-series** — god-object + per-module domain-presence fitness invariants; RFC 8594 deprecation header; ai-service contract bilingual handoff (Zod → JSON Schema → Pydantic, drift-gated).
- **G-series** — `ALLOWED_FORWARD_REF_CYCLES` allowlist (trip↔{food,media,safety}); layer-size invariant; Pydantic emitter; entity enrichment (11 entities with `static create()` + invariants).
- **H-series** — per-file 80% coverage gate on `src/modules/**/domain/*.ts`; Stryker mutation ≥80% with `StringLiteral` + `ObjectLiteral` excluded.

### Test breadth (8 → 10) — I/J/K-series

- 7 authenticated user-flow e2e scenarios + visual-baseline workflow + travel-buddy matchmaking specs + admin-tool specs.
- Web component coverage 3 → 8.

### Test / CI reliability (5 → 10) — L/M-series

- **L1** — Testcontainers fallback with per-worker `?schema=test_w${JEST_WORKER_ID}`.
- **L2** — codemod-swept 111 `if (!dbReachable) return` skip-pass sites.
- **L3** — dropped `--runInBand --forceExit` from the unit gate (parallel by default now).
- **L4** — `@app/clock` package: `Clock` + `SystemClock` + `FakeClock` + `CLOCK` symbol DI token.
- **L5** — dev-server smoke workflow (`pnpm dev` → `/health=200` in CI).
- **L6** — jest `--shard` 4-way + retry-on-error + quarantine workflow.
- **M1** — shutdown-hook fitness invariants (ioredis `OnModuleDestroy + .quit()`, `setInterval → clearInterval`, `*.scheduler.ts` test-env gating).
- **M2** — `ClockModule` `@Global()` + trip/identity slice migrated to `@Inject(CLOCK)`.
- **M3** — jest-junit + nightly `flake-trends.yml` + dep-free `scripts/aggregate-flakes.mjs`.
- **M4** — codemod-stripped 133 e2e specs of `*Reachable` skip-pass (net −1168 lines).
- **M6** — `scripts/codemod-inject-clock.cjs` swept 84 `new Date()` / `Date.now()` sites to CLOCK injection.

### Production / ops readiness (4 → 10) — N/O-series

- **N1** — OTLP 404 fix (SDK gated on real endpoint); local `ops/observability/` stack (Tempo + Prometheus + Grafana).
- **N2** — `docs/slos.md` + MWMR alerts (14.4× / 6× / 3× / 1× burn) + 5 SLO runbooks.
- **N3** — Terraform stack for Fly.io + `terraform-plan.yml` + `terraform-apply.yml`.
- **N4** — `deploy.yml` rewritten: gates → rolling-staging or bluegreen-prod → external smoke → `flyctl releases rollback` on failure.
- **N5** — backups + DR runbook (RTO/RPO matrix) + `scripts/dr/restore-test.sh` drill harness.
- **N6** — Doppler rotation scripts + quarterly `secret-rotation.yml`.
- **N7** — `.github/dependabot.yml` + STRIDE-per-hop threat model + `scripts/security/csp-audit.sh` + `SECURITY.md`.
- **N8** — new `@app/resilience` package (CircuitBreaker + withTimeout + withRetry) + first wrap on `OpenMeteoWeatherProvider`.
- **N9** — Cloudflare WAF + edge rate limits (Terraform, gated on `cloudflare_enabled`).
- **N10** — `docs/compliance/gdpr-audit.md` (Art. 6 / 15-21 + retention matrix + PII inventory).
- **N11** — cost-monitoring runbook + `ci-cost-watch.yml` daily probe.
- **O1** — wrapped the remaining 12 external adapters with `@app/resilience` + new `callExternal()` helper + fitness gate fails CI on any future bare external call.
- **O2** — load shedder Fastify hook (503 + retry-after when event-loop lag ≥100ms OR in-flight ≥200; `/health/*` + `/metrics` always bypass).
- **O3** — two more Grafana dashboards: `slo-burn-rate.json` + `external-resilience.json`.
- **O4** — closed 3 dead doc cross-refs + hardened `restore-test.sh` (operator-supplied `$DR_DUMP_FILE` instead of fictional `supabase db backups` CLI).

### Repo housekeeping

- 11 `apps/` (`api`, `web`, `admin`, `mobile`, `ai-service`, `media-service`, `notification-worker`, `crawler-worker`).
- 14 `packages/` (`shared-types`, `sdk`, `ui`, `mobile-ui`, `logger`, `config`, `errors`, `observability`, `eslint-config`, `tsconfig`, `auth`, `clock`, `events`, `resilience`).
- 64 Prisma models across 17 bounded contexts.
- `pnpm install --frozen-lockfile && pnpm dev:up:verify && pnpm typecheck && pnpm arch && pnpm cycles && pnpm cover:unit` is the canonical green-gate baseline.

[Unreleased]: https://github.com/atuldhull/travel-superapp/compare/v0.0.0...HEAD
