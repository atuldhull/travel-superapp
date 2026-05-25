# Service Level Objectives (SLOs) — TravelSuperApp

> **Status:** v1 (installed by [N2]).
> **Window:** rolling 28 days unless noted.
> **Error-budget policy:** §4 — what we DO when a budget burns.
> **Source-of-truth metrics:** `apps/api/src/common/metrics/metrics.service.ts`.

## 1. The SLIs (what we measure)

Service Level Indicators map a metric on the wire to a question the
user actually asks. Each row below corresponds to a Prometheus query
backed by `prom-client` instrumentation already shipped in the API.

| SLI                   | Question it answers                            | Prom query (5m rate, `service="api"`)                                                                                               |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Availability**      | "Did my request get a non-5xx response?"       | `sum(rate(http_request_duration_seconds_count{status!~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count[5m]))`            |
| **p95 read latency**  | "Did read traffic feel fast?"                  | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{method=~"GET\|HEAD",route!~".*ai.*"}[5m])) by (le))`        |
| **p95 AI latency**    | "Did AI endpoints respond inside SLA?"         | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{route=~".*ai.*\|.*plan.*\|.*memory-book.*"}[5m])) by (le))` |
| **p95 write latency** | "Did mutations feel fast?"                     | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{method=~"POST\|PUT\|PATCH\|DELETE"}[5m])) by (le))`         |
| **Health-ready**      | "Is the api up at all?"                        | `up{job="travel-api"}`                                                                                                              |
| **Cache hit ratio**   | "Is Redis pulling its weight?" (informational) | `sum(cache_hit_total) / clamp_min(sum(cache_hit_total)+sum(cache_miss_total), 1)`                                                   |

## 2. The SLOs (the targets)

| Tier     | SLO                                        | Target   | Window |
| -------- | ------------------------------------------ | -------- | ------ |
| Critical | Availability (all non-5xx)                 | 99.5 %   | 28d    |
| Critical | p95 read latency `GET /api/v1/**` (no AI)  | < 300 ms | 28d    |
| High     | p95 write latency `POST/PUT/PATCH/DELETE`  | < 600 ms | 28d    |
| High     | p95 AI-endpoint latency                    | < 8 s    | 28d    |
| Medium   | Cache hit ratio (informational, no budget) | ≥ 60 %   | 7d     |
| Critical | `up{job="travel-api"}` per probe           | 99.9 %   | 28d    |

### Endpoint tier mapping (informs which SLO applies)

`apps/api/src/main.ts` exposes routes under `/api/v1/*`. Tier
inference:

- **AI** — anything matching `route =~ ".*ai.*|.*plan.*|.*memory-book.*"`
  (planner endpoints, memory-book composer). The Anthropic / Gemini /
  Ollama upstream latency dominates; an 8s p95 is the user-facing
  expectation.
- **Read** — every other `GET` / `HEAD` under `/api/v1/*`.
- **Write** — every `POST` / `PUT` / `PATCH` / `DELETE` not matching the AI
  pattern.

## 3. Error budgets (the maths)

A 99.5 % availability SLO over 28 days = **3h 21m** of budgeted
5xx-equivalent time per window. If 5xx requests x time exceeds
that, we have "burned" the budget.

Burn-rate alerts catch a too-fast spend BEFORE the budget exhausts.
[Google SRE Workbook 5.1 multi-window MWMR](https://sre.google/workbook/alerting-on-slos/)
two-level scheme is what `ops/prometheus/rules/api.rules.yml` ships:

| Severity | Condition (availability)                        | Means                              |
| -------- | ----------------------------------------------- | ---------------------------------- |
| Page     | Burn rate (5m) > 14.4 AND burn rate (1h) > 14.4 | Burns 28d budget in 2h — go now    |
| Page     | Burn rate (30m) > 6 AND burn rate (6h) > 6      | Burns 28d budget in 13h — go soon  |
| Ticket   | Burn rate (2h) > 3 AND burn rate (24h)> 3       | Burns 28d budget in 4d — file work |
| Ticket   | Burn rate (6h) > 1 AND burn rate (72h)> 1       | Just trending wrong                |

The denominator each window is the average error rate that, if
sustained, would burn the entire 28-day budget — `1 - SLO`.

## 4. Error-budget policy

We treat the budget as a **ship-fast budget**. When the budget is
HEALTHY we ship. When it BURNS we slow down.

| Budget remaining | Posture                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **≥ 60 %**       | Ship freely. Risky experiments OK behind feature flags.                                                                                                                                              |
| **30–60 %**      | Ship feature work; merges require a passing `ci` + `dev-server-smoke`. Skip risky migrations or experimental adapters.                                                                               |
| **10–30 %**      | Code freeze on feature work — only reliability fixes + critical security. Daily review.                                                                                                              |
| **< 10 %**       | Halt all non-fix merges. The on-call is responsible for cutting a hotfix and/or reverting the offending change. The pager rules in `ops/prometheus/rules/api.rules.yml` should already be screaming. |
| **Exhausted**    | Post-mortem within 7 days. Update this doc + run the [incident-response runbook](runbooks/incident-response.md).                                                                                     |

The budget is THE alignment tool between reliability and velocity —
not a stick. If we never burn budget, the SLO is too loose; tighten it.

## 5. How to consume / change this

- **The dashboard:** `ops/observability/grafana/dashboards/api-overview.json` shows real-time SLI numbers per tier. SLO panels (budget remaining + burn rate over time) land in [N2]'s second dashboard pass.
- **Adding a new SLO:** edit this doc + add a rule to `ops/prometheus/rules/api.rules.yml` + add a runbook under `docs/runbooks/slo-*`.
- **Changing a target:** doc-PR with the rationale + budget impact. Don't move targets to avoid a page; move them when reality says the user doesn't care about the difference.

## 6. What's NOT measured yet

These are honest gaps for the next iteration:

1. **Per-endpoint SLOs.** Today we bucket by tier (read / write / AI).
   The next refinement is a CRITICAL handful: `POST /trips`,
   `POST /auth/login`, `GET /feed/me`, `GET /trips/:id/overview`.
2. **End-to-end synthetic probes.** k6 smoke ([I7]) hits hot paths
   every CI run, but we don't have a recurring synthetic from a
   real geographic edge. Defer until Grafana Cloud Synthetic
   Monitoring or an external `cron` probe is wired.
3. **Web (Next.js) SLOs.** The web app's Core Web Vitals are not in
   Prometheus today; future work is to push them via the `web-vitals`
   library to a `/web-vitals` ingest endpoint and feed
   `web_lcp_seconds`-style histograms.
4. **Background-job SLOs.** Schedulers (`account-purge`,
   `auto-archive-trips`, `karma-recompute`, `weekly-digest`,
   `orphan-s3-sweep`) emit `domain_events_total` but have no
   "tick succeeded inside its window" SLI yet. Track via a per-
   scheduler `<name>_last_success_timestamp_seconds` gauge in a
   later slice.

## 7. References

- Google SRE Workbook — [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- Multi-Window, Multi-Burn-Rate scheme — the "14.4 / 6 / 3 / 1" magic numbers
- Internal: [ops/prometheus/rules/api.rules.yml](../ops/prometheus/rules/api.rules.yml), [docs/runbooks/](runbooks/)
