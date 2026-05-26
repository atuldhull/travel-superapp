# Capacity matrix

> **Installed by [Q7]** of the Scale-readiness 3→10 series. Companion to [`load/`](../../load/) (k6 scripts) + [`database-pooling.md`](../runbooks/database-pooling.md) + [`redis-cluster-posture.md`](../runbooks/redis-cluster-posture.md).
>
> "What's p99 at 1k / 10k / 100k RPS?" — the honest answer today is "measured for some surfaces, modelled for others, unknown for the rest." This doc is the source of truth on which numbers are real and which are projection.

## Route classes (capacity envelope, not behaviour)

A "route class" groups endpoints with the same bottleneck. Capacity is per-class, not per-endpoint — if a class is bottlenecked on the LLM provider, that's the cap whether the route is `/api/v1/plan` or `/api/v1/diary/continue`.

| Class                  | Bottleneck                                      | Examples                                                                          | Cacheable?                            |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| **Probe**              | Node event loop                                 | `/api/v1/health/live`, `/metrics`                                                 | n/a                                   |
| **Public read**        | Postgres + Redis cache                          | `/api/v1/places/featured`, `/api/v1/feed/public`, `/api/v1/trips/published/:slug` | edge + origin                         |
| **Authenticated read** | Postgres (sometimes pgvector)                   | `/api/v1/trips`, `/api/v1/account/me`, `/api/v1/feed`                             | origin only                           |
| **Write**              | Postgres + outbox + Redis Streams               | `/api/v1/trips` POST, `/api/v1/social/share`                                      | never                                 |
| **AI / LLM**           | External provider (Anthropic / Gemini / Ollama) | `/api/v1/plan`, `/api/v1/diary/continue`                                          | conditional (idempotent prompts only) |
| **Embeddings**         | ai-service + pgvector                           | `/api/v1/places/semantic-search`                                                  | origin                                |
| **External-write**     | Stripe / Resend / Twilio                        | `/api/v1/payments/checkout`, `/api/v1/auth/email/login`                           | never                                 |
| **SOS**                | Twilio voice + DB write                         | `/api/v1/safety/sos`                                                              | never                                 |

## Targets

Per-class target latency (origin-perceived, NOT user-perceived). Add ~80 ms for round-trip from Cloudflare to user.

| Class              | Target p50                            | Target p95 | Target p99 | SLO source                              |
| ------------------ | ------------------------------------- | ---------- | ---------- | --------------------------------------- |
| Probe              | < 5 ms                                | < 20 ms    | < 50 ms    | derived (no SLO)                        |
| Public read        | < 50 ms                               | < 200 ms   | < 500 ms   | `docs/slos.md` "read latency"           |
| Authenticated read | < 80 ms                               | < 300 ms   | < 600 ms   | `docs/slos.md` "read latency"           |
| Write              | < 150 ms                              | < 600 ms   | < 1500 ms  | `docs/slos.md` "write latency"          |
| AI / LLM           | < 3 s                                 | < 8 s      | < 15 s     | `docs/slos.md` "AI latency" + Q10 doc   |
| Embeddings         | < 200 ms                              | < 800 ms   | < 2 s      | derived from "AI latency" minus LLM     |
| External-write     | < 500 ms                              | < 2 s      | < 4 s      | derived (upstream SLA + retry budget)   |
| SOS                | < 2 s end-to-end (Twilio call placed) | n/a        | n/a        | `docs/runbooks/slo-availability.md` SOS |

## What we know today

Measured locally on a Windows dev box (Ryzen 7, 32 GB) with [`load/smoke.js`](../../load/smoke.js) on a single-node Postgres + Redis:

| Surface         | RPS sustained | p95 observed | p99 observed | Date measured | Source                   |
| --------------- | ------------- | ------------ | ------------ | ------------- | ------------------------ |
| `/health/live`  | ~6000         | 12 ms        | 28 ms        | 2026-05-21    | smoke.js                 |
| `/health/ready` | ~1200         | 38 ms        | 96 ms        | 2026-05-21    | smoke.js (DB+Redis ping) |
| `/metrics`      | ~3500         | 15 ms        | 41 ms        | 2026-05-21    | smoke.js                 |
| `/featured`     | ~800          | 110 ms       | 320 ms       | 2026-05-21    | smoke.js                 |
| `/feed/public`  | ~600          | 140 ms       | 410 ms       | 2026-05-21    | smoke.js                 |

Production numbers are NOT measured yet — local-dev figures are an upper bound on what the same code path can do; prod's network + managed-DB latency adds 30-80 ms. Real targets land after the first staging soak.

### Changes since the last measurement (2026-05-21 → 2026-05-26)

Several Q + R series changes affect these numbers but **haven't been re-measured**. Honest list of what should now perform differently:

| Change                                                      | Expected effect on the table above                                                                                                          | Re-measure when                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Q1 — PgBouncer wired (gated; not active locally by default) | Sustained RPS on DB-touching surfaces (`/health/ready`, `/featured`, `/feed/public`) should rise 3-5× when `--profile pool` is active       | Re-run smoke with `docker compose --profile pool up -d`  |
| Q3 — `@app/jobs` BullMQ + JobsService                       | Surfaces that previously did inline work (notifications, media-variants when migrated) will drop p95 once the dispatchers move to the queue | After per-feature dispatcher migration                   |
| Q6 — Cloudflare cache rules                                 | `/featured` + `/feed/public` p99 should drop ~5-10× on cache HIT (edge serves; origin idle)                                                 | Requires `cloudflare_enabled = true`                     |
| Q9 — Multi-region                                           | p99 from EU users drops ~80 ms when lhr machines exist + are reachable                                                                      | Requires push to origin + multi-region drill             |
| R4 — Read-replica accessor                                  | When use-cases adopt `$readReplica()`, primary CPU drops; replica latency adds ~5 ms hop                                                    | When use-cases mark reads + DATABASE_URL_READONLY set    |
| R6 — ai-service deployable                                  | Translation + embeddings paths no longer terminate at the api process when routed to ai-service                                             | After apps/api adapters point at the deployed ai-service |

This means today's table is a **lower bound on what the stack can do post-Q/R**. Numbers will improve materially the first time staging is exercised after all the operator-owed bits land.

### Why no new measurements this session

Honest disclosure: the R7 re-measurement was attempted on 2026-05-26 but blocked by:

1. Docker Desktop not running on the dev box (no Postgres, Redis, Meilisearch, MinIO).
2. No staging environment provisioned yet (operator-owed; deploy.yml fires on `git push origin main` per the post-O memory).

The right move is to re-run smoke once the operator-owed pieces land — fabricating new numbers locally without exercising the actual Q-series changes would mislead. The 2026-05-21 numbers stand as the reference until then.

## What we don't know

| Question                                                         | Owner | Path to an answer                                                               |
| ---------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------- |
| What does `/api/v1/plan` do at 100 concurrent users?             | TBD   | Run [`load/stress.js`](../../load/stress.js) with an AI-targeting profile (Q10) |
| What's the max RPS on `/featured` with edge cache hot?           | TBD   | Run stress.js after Q6's Cloudflare cache rules land in staging                 |
| How many BullMQ workers does notification need at 10k email/min? | TBD   | Synthetic producer test once notification-dispatchers migrate from inline       |
| What's the Postgres CPU shape at 1000 active txns?               | TBD   | Run stress.js with `concurrency=200`; watch `pg_stat_activity`                  |
| What's p99 with Cloudflare caching = on?                         | TBD   | Same as above, just enable `cloudflare_enabled = true` first                    |
| What's the read-replica lag p95 under prod write load?           | TBD   | Available after Supabase Team upgrade + DATABASE_URL_READONLY set + R4 adopted  |
| What's ai-service p95 for /v1/embeddings at 1k req/s?            | TBD   | Available after R6's ai-service deploys + apps/api adapters route to it         |
| Effect of PgBouncer pool on test-suite max_connections cascade?  | TBD   | Re-run integration suite with `docker compose --profile pool up -d` (Q1)        |

These get filled in as the team runs measurements. Don't fabricate answers — the honest "TBD" beats a made-up "should be fine".

## Tier targets (where we want to be)

| Tier          | Concurrent users | Sustained RPS | Notes                                                                        |
| ------------- | ---------------- | ------------- | ---------------------------------------------------------------------------- |
| **Today**     | ~100             | ~50           | Single Fly machine, free Supabase, free Upstash                              |
| **1k tier**   | ~5,000           | ~1,000        | 2× Fly machines, Supabase Pro, Upstash standard                              |
| **10k tier**  | ~50,000          | ~10,000       | 5× Fly machines, Supabase Team, Upstash Pro, multi-region (Q9)               |
| **100k tier** | ~500,000         | ~100,000      | Custom Postgres (RDS or Aurora), Redis Cluster, dedicated AI inference (Q10) |

The 1k tier is the next operational target. Everything in this Q-series is in service of getting there cleanly.

## Per-tier checklist

Before declaring readiness for a tier, run the gauntlet:

### 1k tier

- [ ] PgBouncer enabled (Supabase Pro `?pgbouncer=true` URL) — Q1
- [ ] Cloudflare cache rules ON in production — Q6 `cloudflare_enabled = true`
- [ ] At least 2 Fly machines (`fly scale count 2 -a travel-api-prod`)
- [ ] stress.js at 400 VUs sustains p95 < 600 ms across all classes
- [ ] notification-worker deployed (Q4) + actually receiving real jobs
- [ ] First DR drill passed (`scripts/dr/restore-test.sh`) — N5

### 10k tier

- [ ] Above
- [ ] Multi-region (Q9 lands)
- [ ] Read replica on Supabase Team
- [ ] Per-provider spending caps configured (N11)
- [ ] AI inference posture decided (Q10)

### 100k tier

- [ ] Above
- [ ] Redis Cluster (Q2 migration path)
- [ ] pgvector → HNSW (Q5 trigger)
- [ ] Dedicated Postgres (move off Supabase) — multi-month operator-owed

## How to update this matrix

When you run a meaningful load test:

1. Note the SHA + the load posture (smoke / stress / soak).
2. Append a row to "What we know today" with date + RPS + p95 + p99.
3. If it changes a tier-readiness claim, tick the box (or un-tick).
4. Commit with `perf(Q7): measured <surface> at <RPS> RPS — p99 <ms>`.

History stays in git — no need for a separate trends sheet.

## See also

- [`load/`](../../load/) — k6 scripts (smoke / stress / soak)
- [`load/README.md`](../../load/README.md) — how to run them
- [`docs/slos.md`](../slos.md) — the latency SLOs the targets derive from
- [`docs/runbooks/slo-read-latency.md`](../runbooks/slo-read-latency.md) — what to do when reads breach
- [`docs/runbooks/slo-ai-latency.md`](../runbooks/slo-ai-latency.md) — AI latency playbook
- [`docs/runbooks/database-pooling.md`](../runbooks/database-pooling.md) — sizing math
- [`.github/workflows/load-extended.yml`](../../.github/workflows/load-extended.yml) — nightly soak + manual stress
