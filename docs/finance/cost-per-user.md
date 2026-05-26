# Cost-per-user model

> **Installed by [Q11]** of the Scale-readiness 3→10 series. Companion to [`docs/runbooks/cost-monitoring.md`](../runbooks/cost-monitoring.md) (the per-provider monitoring) + [`docs/architecture/ai-inference-scale.md`](../architecture/ai-inference-scale.md) (the AI cost levers).
>
> "Does scale bankrupt us?" — answered with concrete per-user cost math, broken down by feature, with explicit assumptions and a tier-break-even table. **Numbers are estimates from public pricing as of 2026-05** — re-run quarterly with actual usage data once we have it.

## Pricing snapshot (2026-05)

All providers, current published rates. Update when a contract changes.

| Service                 | Unit                                 | Cost                                              |
| ----------------------- | ------------------------------------ | ------------------------------------------------- |
| Supabase Pro            | flat                                 | $25 / mo (DB up to 8 GB · PITR · 200 connections) |
| Supabase Team           | flat                                 | $599 / mo (read replica + 100 GB DB)              |
| Fly.io shared-cpu-1x    | machine-month                        | $1.94 (256 MB) · $3.89 (512 MB) · $7.78 (1 GB)    |
| Fly.io shared-cpu-2x    | machine-month                        | $15.55 (2 GB)                                     |
| Fly.io performance-2x   | machine-month                        | $76.40 (4 GB)                                     |
| Upstash Redis (free)    | flat                                 | $0 (10k req/day cap)                              |
| Upstash Redis (Pro)     | per 100k commands                    | $0.20                                             |
| Cloudflare R2           | per GB stored / mo                   | $0.015                                            |
| Cloudflare R2           | per million Class A (write) requests | $4.50                                             |
| Cloudflare R2           | per million Class B (read) requests  | $0.36                                             |
| Resend                  | per 1k emails                        | $1.00 (paid tier; 3k/mo free)                     |
| Twilio                  | per SMS (US)                         | $0.0079                                           |
| Twilio                  | per voice minute (US toll-free)      | $0.013                                            |
| Anthropic Claude Opus 4 | per 1M input tokens                  | $15.00                                            |
| Anthropic Claude Opus 4 | per 1M output tokens                 | $75.00                                            |
| Google Gemini 2.5 Flash | per 1M input tokens                  | $0.075                                            |
| Google Gemini 2.5 Flash | per 1M output tokens                 | $0.30                                             |
| Ollama (self-host)      | per request                          | $0 (CPU) or amortised GPU cost                    |
| Sentry (Team)           | flat                                 | $26 / mo (50k errors)                             |
| Honeycomb (Free)        | flat                                 | $0 (≤ 20M events / mo)                            |
| PostHog (Free)          | flat                                 | $0 (≤ 1M events / mo)                             |
| Doppler (free tier)     | flat                                 | $0 (≤ 5 users)                                    |

## Per-feature cost model (free-tier user, monthly)

Assumes: 1 trip planned, 7-day trip, 1 published trip, 20 places looked up, 3 memory-book photos uploaded, 50 push notifications, 100 page views.

| Feature                | Driver                                     | Cost / user / month                        | Notes                                                       |
| ---------------------- | ------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| **Trip planning (AI)** | 1 plan × 2k in + 4k out tokens (Claude)    | $0.030 + $0.300 = **$0.33**                | Most expensive line. Cached at 50% hit ratio → **$0.165**.  |
| **Diary continuation** | 5 entries × 500 in + 200 out (Claude)      | $0.075 + $0.075 = **$0.15**                | Premium feature; free tier may not get this.                |
| **Translation**        | 20 phrases × 50 in + 50 out (Gemini Flash) | $0.000075 + $0.0003 = **$0.0004**          | Cached at 80% → **$0.00008**.                               |
| **Embeddings**         | 20 place lookups × 1 embed (Ollama, $0)    | **$0.00**                                  | Free on the self-host path.                                 |
| **Place lookups**      | 20 Google Places API calls                 | $0.00 (free tier 200/mo)                   | Spills to paid at heavy use only.                           |
| **Postgres reads**     | ~1000 reads × tiny rows                    | $0.00 (Pro flat)                           | Until DB exceeds 8 GB.                                      |
| **Redis ops**          | ~3000 commands (cache + rate-limit)        | **$0.006** at $0.20/100k                   | Free tier covers free users entirely.                       |
| **R2 storage**         | 3 photos × 2 MB = 6 MB                     | **$0.0001** stored                         | Plus $0.0001 in Class B reads.                              |
| **R2 reads**           | 100 page views × 3 images = 300 reads      | **$0.0001**                                | Cache-hit ratio on Cloudflare reduces origin reads further. |
| **Email**              | 5 transactional emails                     | $0.005 (3k/mo free covers ~600 free users) | Marginal cost only past free tier.                          |
| **SMS / push**         | 50 push (web-push free) + 0 SMS            | **$0.00**                                  | SMS only on SOS / 2FA — assume 0.05/user.                   |
| **Fly machines**       | flat per-instance                          | amortised — see below                      | Not per-user.                                               |

**Free-tier marginal cost / user / month ≈ $0.18** (worst case, no caching). With caching applied: **~$0.10** / user / month.

## Per-feature cost model (Premium user, monthly)

Assumes: 5 trips planned, 30 published trips, unlimited translation, real-time diary, 100 photos, full SMS / voice on SOS.

| Feature                | Driver                                   | Cost / user / month         |
| ---------------------- | ---------------------------------------- | --------------------------- |
| **Trip planning (AI)** | 5 plans × Claude (above × 5)             | **$1.65** (after 50% cache) |
| **Diary**              | 100 entries × Claude                     | **$3.00**                   |
| **Translation**        | 500 phrases × Gemini Flash (cached 80%)  | **$0.002**                  |
| **Embeddings**         | 100 lookups (Ollama)                     | **$0.00**                   |
| **Place lookups**      | 100 Google Places (over free tier)       | **$0.50**                   |
| **R2 storage**         | 100 photos × 3 MB = 300 MB               | **$0.0045**                 |
| **R2 reads**           | ~2000 image fetches / mo                 | **$0.0007**                 |
| **Email**              | 30 transactional                         | **$0.03**                   |
| **SMS / voice**        | 2 SOS events × ($0.02 SMS + $0.05 voice) | **$0.14**                   |
| **Subtotal**           |                                          | **~$5.33**                  |

## Fixed costs (flat, regardless of user count)

| Component                      | Monthly      | Notes                           |
| ------------------------------ | ------------ | ------------------------------- |
| Supabase Pro                   | $25          | Required for prod-grade DB      |
| Upstash Pro                    | ~$10         | Free tier covers up to ~5k DAU  |
| Fly.io api (2 machines, prod)  | $31          | 2 × shared-cpu-2x, 2 GB each    |
| Fly.io workers (3 × 2 regions) | ~$18         | 3 workers × 2 regions × ~$3 avg |
| Sentry                         | $26          | Team plan                       |
| Honeycomb / PostHog            | $0           | Free tiers suffice early        |
| **Total fixed**                | **~$110/mo** |                                 |

## Break-even math

Premium subscription priced at **$9.99/mo** (placeholder — adjust to real plan).

- **Gross margin per Premium user:** $9.99 − $5.33 = **$4.66** (54% margin).
- **Fixed cost coverage:** $110 / $4.66 = **24 Premium users to break even on infra**.
- **First 1000 Premium users** at this shape: 1000 × $4.66 = **$4,660/month gross margin** (before salary, marketing, taxes).

Free users at scale:

- **10,000 free users** at $0.10 each = **$1,000/month** in marginal AI + email costs.
- Funded by ~215 Premium users (10,000 × 0.10 = 1,000 → 1,000 / 4.66 = 215).

This means the model holds at **~2-3% Premium conversion**, which is in line with standard SaaS conversion benchmarks. If conversion drops below 1.5%, AI caching becomes existential — pushing semantic cache hit ratio from 50% to 70% cuts free-tier cost by 40%.

## Sensitivity — what moves the needle most

If everything below were applied at the same time, free-tier cost drops to ~$0.04 / user / month.

| Lever                     | Today             | Best case                                          | Impact on free-user cost                   |
| ------------------------- | ----------------- | -------------------------------------------------- | ------------------------------------------ |
| Semantic cache hit ratio  | 0% (not deployed) | 70%                                                | -70% AI cost = **-$0.07 / user**           |
| AI model choice           | Claude Opus       | Claude Sonnet for first pass + Opus for refinement | -50% AI cost = **-$0.05 / user**           |
| Ollama for diary          | Anthropic         | Self-host (Premium only)                           | -100% diary cost = **-$0.15 / Premium**    |
| Edge caching on /featured | OFF               | ON (Q6)                                            | -70% R2 reads + -90% Postgres CPU at scale |
| Worker concurrency tuning | default           | per-workload tuned                                 | minor — but stops over-provisioning Fly    |

Caching is by far the biggest lever. Q6 enables edge caching; Q10 plans the AI-side caching. The model assumes neither is on today — actual free-tier cost should drop as both ship.

## What this model does NOT include

- **Salaries** (anyone's). This is infra + per-user variable cost only.
- **Marketing / acquisition cost.** Out of scope.
- **Payment processor fees.** Stripe takes ~2.9% + $0.30 per Premium transaction; would subtract ~$0.59 from the $4.66 gross margin per user.
- **App store fees** (Apple / Google take 15-30% of in-app subscriptions). If we sell Premium through the app stores, the $9.99 → $7.00-$8.50 net.
- **Tax / VAT.** Varies by jurisdiction.
- **Compliance / audit / legal.** SOC 2 audit is ~$15-30k upfront when the time comes.

## Update cadence

Quarterly. The provider pricing table at the top is the only thing that changes most quarters; the per-feature volume assumptions only need updating when product behaviour changes (new feature, deprecated feature, free-tier limit change).

Per-quarter check:

1. Run cost-monitoring.md's per-provider dashboard pull.
2. Compare actual $/user against this model's prediction.
3. If actual > 1.5× model: investigate. Either pricing changed or a feature drifted.
4. Update the table + commit with `docs(Q11): refresh cost model — <quarter>`.

## See also

- [`docs/runbooks/cost-monitoring.md`](../runbooks/cost-monitoring.md) — the per-provider alerting + CI billing watch
- [`docs/architecture/ai-inference-scale.md`](../architecture/ai-inference-scale.md) — the cost-bending levers on AI specifically
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — the volume side of the same equation
- [`docs/runbooks/edge-rate-limiting.md`](../runbooks/edge-rate-limiting.md) — caching at the edge (cuts compute + R2 cost)
- [`.github/workflows/ci-cost-watch.yml`](../../.github/workflows/ci-cost-watch.yml) — daily GH Actions usage probe
