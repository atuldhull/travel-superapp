# Runbook — Cost monitoring

> **Installed by [N11].** Per-provider monthly budgets + the
> alerting that catches a runaway spend BEFORE the bill arrives.

## Why this matters

Free tiers + low-priced plans drift quietly. A 6-month-old runaway
log volume turns the $5/mo plan into a $250/mo plan; nobody notices
until the credit card statement. Each provider has a free or
near-free guardrail we can set TODAY.

## Per-provider budgets + alerts

| Provider           | What we use it for              | Free quota                           | $0 budget alert mechanism                                                                                                             |
| ------------------ | ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Fly.io**         | api + web compute               | $5 / mo credit                       | Settings → Billing → Spending alerts. Set thresholds at $20 (warn) + $50 (page). Email + webhook.                                     |
| **Supabase**       | Postgres (PITR on Pro = $25/mo) | 500MB DB, no PITR                    | Org dashboard → Usage. Hard cap at $30/mo via Stripe customer portal; alerts via email when approaching.                              |
| **Upstash**        | Redis                           | 10k commands / day                   | Project → Usage → Alerts. Threshold $10/mo. Email.                                                                                    |
| **Cloudflare R2**  | Media storage                   | 10GB storage + 1M ops / mo           | Cloudflare → Workers & Pages → Billing. R2 has its own "monthly billing alert" at $20.                                                |
| **Anthropic**      | LLM (premium tier)              | $5 free trial credit                 | Console → Billing → Usage limits. HARD CAP at $50/mo. The api falls back to Gemini if Anthropic returns billing 429 — no user impact. |
| **Gemini**         | LLM (free-tier fallback)        | 1500 req/day                         | No alert path on free tier — usage panel shows quota. If it caps, OllamaTripPlannerAdapter takes over (or Stub).                      |
| **Honeycomb**      | OTel spans                      | 20M events / mo                      | Settings → Usage → Email alerts at 80% of free quota.                                                                                 |
| **Sentry**         | Error tracking                  | 5k errors / mo, 1M perf transactions | Org Settings → Usage & Billing → Spending caps + email alerts.                                                                        |
| **Resend**         | Transactional email             | 100 emails / day                     | Dashboard → Usage → Email alerts when approaching limit.                                                                              |
| **Twilio**         | SMS (SOS, MFA)                  | $15 free trial credit                | Console → Billing → Usage triggers. Threshold $20/mo. After trial credit, $15/mo budget hard-cap.                                     |
| **Stripe**         | Billing                         | No free tier; transaction fees       | Dashboard → Developers → Webhooks (no fixed monthly cost — fee-based). Monitor MRR; flag when failed-payment % > 5%.                  |
| **OpenSky**        | Flight signals (agent)          | Anonymous = free, low rate-limit     | No billing surface.                                                                                                                   |
| **Open-Meteo**     | Weather                         | Free, no auth                        | No billing surface.                                                                                                                   |
| **Doppler**        | Secrets                         | Up to 5 users free                   | Workplace settings → Plans. Email alerts on plan-tier change.                                                                         |
| **GitHub Actions** | CI minutes                      | 2000 min / mo on private repos       | Settings → Billing → Spending limit. Set HARD cap at $20/mo. See workflow below for the additional in-repo alert.                     |

Total monthly budget at "everything-paid" tier (free tiers
maxed but nothing dangerously over): **~$160/mo**. Today's reality
is $0/mo because every paid tier above is operator-owed to opt
into.

## The GitHub Actions usage alert

`.github/workflows/ci-cost-watch.yml` runs daily, pulls
`actions/billing/usage` from the GitHub API, and posts a step-
summary table. If the monthly usage exceeds **80%** of the configured
budget, it opens a tracking issue.

```bash
# Manual run + dry test:
gh workflow run ci-cost-watch.yml --field budget_minutes=2000
```

## Quarterly cost review

The first Monday of each quarter:

1. Pull last 90 days of bills from each provider.
2. Compare against budget table above. Flag any > 1.5×.
3. For LLM costs (Anthropic / Gemini), pull `domain_events_total`
   for `ai.plan_generated` to compute cost-per-plan. Multiply by
   projected DAU.
4. File a cost-review issue with the spreadsheet attached.

## What to do when an alert fires

| Alert                                 | First action                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Fly compute > $20/mo                  | `fly status --app travel-api-prod` — check machine count. Did autoscaler stay scaled out after a load test? |
| Anthropic > $50/mo                    | `fly secrets unset ANTHROPIC_API_KEY --app travel-api-prod` — falls back to Gemini until investigated.      |
| Twilio > $20/mo                       | SOS abuse? Check SOS events per user this month; rate-limit at app layer.                                   |
| Honeycomb > 16M events/mo (80%)       | Bump trace sample rate down: `tracesSampleRate` in `sentry.init.ts` (Sentry) or via env for OTel.           |
| GitHub Actions > 80% (workflow alert) | Reduce shard count on the `tests` matrix (4 → 2) or move heavy jobs to nightly cron.                        |

## Cross-refs

- [`docs/runbooks/fly-deploy.md`](fly-deploy.md) — Fly machine sizing
- [`docs/runbooks/slo-ai-latency.md`](slo-ai-latency.md) — LLM fallback chain mechanics
- [`docs/runbooks/secrets.md`](secrets.md) — where the provider tokens live
- [`.github/workflows/ci-cost-watch.yml`](../../.github/workflows/ci-cost-watch.yml) — the GH Actions usage workflow
