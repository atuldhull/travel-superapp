# Runbook: incident response

> Installed by prompt `[POST.10]`. Companion to
> [`docs/runbooks/secrets.md`](./secrets.md) and
> [`docs/runbooks/env-reference.md`](./env-reference.md).
>
> **Status:** dashboard URLs are placeholders until the Sentry +
> Honeycomb projects are created. Update this file in the same PR
> that wires the real DSN / API key.

## Severity ladder

| Sev    | Examples                                                         | Response time     | Pager |
| ------ | ---------------------------------------------------------------- | ----------------- | ----- |
| **S1** | api 5xx > 5% sustained; data loss; auth bypass; live SOS broken  | < 5 min           | yes   |
| **S2** | One feature degraded; webhook backlog growing; trip-planner down | < 30 min          | yes   |
| **S3** | Visual bug; one route slow; observability gap                    | next business day | no    |

## First-response checklist (S1 / S2)

1. **Acknowledge** — claim the incident in `#incidents` (or your equivalent channel).
2. **Check the dashboards** in this order:
   - **Sentry** (errors): `https://sentry.io/organizations/<TODO>/issues/?project=<TODO>&statsPeriod=15m`
   - **Honeycomb** (traces): `https://ui.honeycomb.io/<TODO>/datasets/api-production`
   - **Fly metrics**: `flyctl status -a <FLY_APP_API>` + `flyctl logs -a <FLY_APP_API>`
   - **GitHub Actions** (most-recent deploy): `https://github.com/<owner>/<repo>/actions/workflows/deploy.yml`
3. **Form a hypothesis** — what changed in the last hour? Check:
   - Latest deploy SHA (from the GH Actions deploy log)
   - Latest db migration applied
   - Any external API outage (Stripe, Anthropic, Resend, Google) — check their status pages
4. **Mitigate first, root-cause second.** Reach for these (in order):
   - **Rollback** the deploy: `flyctl deploy --image registry.fly.io/<APP>:<previous-tag>`
   - **Feature flag** the offending feature off (if behind a flag)
   - **Scale up** Fly machines if it's load-driven
   - **Restart** the api if a memory leak / connection-pool exhaustion is suspected
5. **Communicate** — post a status update every 30 min in the channel + on
   `/status` once the public status page is wired (POST.10 placeholder).
6. **Postmortem** — within 48h of resolution, file a blameless writeup in
   `docs/incidents/YYYY-MM-DD-<slug>.md` with timeline + root cause + action items.

## Per-symptom diagnostic links

### api 5xx spike

- Sentry → filter by `level:error` + `environment:production` + last 15min
- Honeycomb → `count(*) WHERE http.status_code >= 500 GROUP BY http.route`
- Fly logs → `flyctl logs -a <FLY_APP_API> | grep '"level":"error"'`

### Database connection issues

- Symptom: 500s from many routes, "connection pool" errors
- Check Supabase dashboard for instance status
- Verify `DATABASE_POOL_MAX` is below Supabase's connection cap (currently 100 on free tier)
- Historical: full e2e suite cascade-failed on default jest concurrency until [L1]+[L3] per-worker `?schema=test_w${JEST_WORKER_ID}` iso lifted the `max_connections=100` ceiling; if a similar pattern returns, suspect schema-iso regression first.

### Stripe webhook backlog

- Symptom: Premium upgrades not reflecting in `/account/billing` for users
- Check Stripe Dashboard → Webhooks → endpoint health
- If signature verification is failing: rotate `STRIPE_WEBHOOK_SECRET` (Stripe Dashboard → reveal new secret) and update env
- Webhooks are idempotent (`stripeSubscriptionId @unique`) — safe to replay from Stripe's dashboard

### Trip planner timeouts

- Symptom: `/trips/[id]/plan-with-ai` slow or 500ing
- Check the active provider order via `/api/v1/health/ready` response shape (once wired)
- For now, check api logs for `trip_planner_*_failed` warnings
- Anthropic / Gemini outages → fall back to Ollama (if `OLLAMA_URL` set) or built-in stub
- Per provider chain in [`docs/external-apis.md`](../external-apis.md#ai--llm-providers-post4)

### Image-upload variant pipeline failures

- Symptom: `/admin/media` shows asset thumbnails as fallback icons
- Check api logs for `media_variants_failed_nonfatal` lines
- Sharp pipeline is best-effort — assets are still `ready`, just no variants
- Manual backfill: there's no use-case yet; track in a follow-up if widespread

## Sentry triage

When an error first lands in Sentry:

1. **Read the breadcrumb trail** at the bottom of the issue — usually shows the route + user action that triggered it
2. **Check the user count** — single user = isolated bug, many users = production incident
3. **Group similar issues** — Sentry auto-groups, but verify the fingerprint matches your expectation
4. **Assign + create a tracking issue** in GitHub linked from Sentry
5. **Resolve in Sentry** only after the fix is deployed (Sentry watches release tags to auto-resolve)

## Honeycomb triage

When latency or throughput degrades:

1. **Open the dataset** → switch to the relevant timeframe (last 1h is the default)
2. **Group by `http.route`** + sort by P99 duration desc — top route is usually the culprit
3. **Drill into one slow span** → check child spans for the slow downstream (Postgres? Redis? external API?)
4. **Tracing.ts** explicitly disables `fs` + `dns` auto-instrumentation to reduce span noise — keep it that way

## Escalation contacts

- **Security disclosure**: `security@travel.local`
- **Privacy/data-subject requests**: `privacy@travel.local`
- **Billing questions**: `billing@travel.local`
- **Engineering oncall**: TBD — wire this up once we have a real rotation

## See also

- [`docs/runbooks/runbook-external-api-degraded.md`](./runbook-external-api-degraded.md) — circuit-breaker playbook for upstream API outages
- [`docs/external-apis.md`](../external-apis.md) — every external dependency + free-tier limits + fallback behaviour
- [`docs/POST_VUX_GAPS.md`](../POST_VUX_GAPS.md) §POST.10 — the spec this runbook was built from
