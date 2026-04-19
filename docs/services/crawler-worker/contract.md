# crawler-worker contract

> NestJS standalone app + Playwright + BullMQ + cron. Scheduled scrapers that pull data from sources that don't have clean APIs (hotel prices, local events, OSM diffs). Extracted so headless Chromium instances — memory-hungry and long-running — never co-exist with the request path.
>
> Installed by prompt `[II.7.3]`. See [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) and [context-map §Stays, §Events](../../architecture/context-map.md).

---

## 1. Transport

**Primary: cron-scheduled self-enqueue.** The worker's own scheduler (BullMQ's repeat option) drops jobs onto internal queues at fixed intervals. No external trigger needed for the steady state.

**Secondary: command queue.** `apps/api` or `apps/admin` may enqueue a one-off crawl (e.g. "refresh prices for this trip's stays now"). Goes through `crawler.command.*` queues.

**Outbound:** results are PUBLISHED as domain events on the `@app/events` bus — `Stays.StayPriceRefreshed`, `Events.CulturalEventIndexed`, etc. Consumers (Stays module, Events module, Notifications for price-drop alerts) subscribe as usual.

**No inbound HTTP** except `/v1/health`. The worker has no synchronous API surface — it's a producer of events, not a request handler.

**Egress.** All outbound HTTP goes through a rate-limited HTTP client (`@app/ratelimit` consumer) so we respect each source's robots / ToS / public rate limits. OSM Overpass API has a strict 10,000 requests/day cap that we honour with a fixed cron cadence + backoff on 429.

---

## 2. Queues / Topics / Endpoints

### Scheduled jobs (cron)

```ts
export const ScheduledJobSchedule = z.object({
  name: z.string(), // e.g. "prices.refresh.daily"
  cron: z.string(), // e.g. "0 3 * * *" — 03:00 UTC daily
  timezone: z.literal('UTC'),
  jobName: z.enum(['prices.refresh', 'events.scrape', 'osm.diff']),
  payload: z.record(z.string(), z.unknown()).default({}),
});
```

Default cadence, committed in `apps/crawler-worker/src/schedules.ts` (lands with the module skeleton):

| Name                   | Cron          | Job              | Notes                                           |
| ---------------------- | ------------- | ---------------- | ----------------------------------------------- |
| `prices.refresh.daily` | `0 3 * * *`   | `prices.refresh` | One pass across all stays; split into sub-jobs. |
| `events.scrape.hourly` | `15 * * * *`  | `events.scrape`  | Per launch city.                                |
| `osm.diff.6h`          | `0 */6 * * *` | `osm.diff`       | Pull Overpass diffs since last watermark.       |

### Queue: `crawler.prices.refresh`

```ts
export const PricesRefreshJob = z.object({
  stayIds: z.array(z.string().uuid()).min(1).max(100),
  providers: z.array(z.enum(['booking', 'airbnb-public', 'agoda'])).min(1),
});
export const PricesRefreshResult = z.object({
  stayId: z.string(),
  provider: z.string(),
  priceUsd: z.number().nonnegative(),
  currency: z.string().length(3),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  scrapedAt: z.string().datetime(),
  sourceUrl: z.string().url(),
});
```

Published event: `Stays.StayPriceRefreshed` (per-stay, per-provider).

### Queue: `crawler.events.scrape`

```ts
export const EventsScrapeJob = z.object({
  city: z.string(),
  sources: z.array(z.enum(['meetup', 'eventbrite-public', 'local-municipal-sites'])).min(1),
  windowDays: z.number().int().min(1).max(30).default(14),
});
export const ScrapedCulturalEvent = z.object({
  sourceKey: z.string(),
  sourceName: z.string(),
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  venueName: z.string().optional(),
  coordinates: z.tuple([z.number(), z.number()]).optional(),
  priceRange: z
    .object({ min: z.number(), max: z.number(), currency: z.string().length(3) })
    .optional(),
  sourceUrl: z.string().url(),
});
```

Published event: `Events.CulturalEventIndexed` per deduped event.

### Queue: `crawler.osm.diff`

```ts
export const OsmDiffJob = z.object({
  bbox: z.object({
    minLat: z.number(),
    minLng: z.number(),
    maxLat: z.number(),
    maxLng: z.number(),
  }),
  sinceWatermark: z.string().datetime(), // ISO timestamp of last successful pull
});
export const OsmDiffResult = z.object({
  bbox: z.unknown(),
  added: z.number().int().nonnegative(),
  modified: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  newWatermark: z.string().datetime(),
  processingMs: z.number().int().nonnegative(),
});
```

Published events: `Places.PlaceIndexed` / `Places.PlaceRetired` as the Places module consumes the diff.

### `GET /v1/health`

`{status, queues, scheduler: {nextRuns: [{name, nextAt}]}}`.

---

## 3. SLO

Crawler SLOs are measured by **freshness**, not latency — "how stale is data allowed to be?" is the right question.

| Data class                   | Max staleness      | Availability of scheduled run     | Notes                                                      |
| ---------------------------- | ------------------ | --------------------------------- | ---------------------------------------------------------- |
| Stay prices                  | 26 h               | Daily run MUST succeed 29/30 days | Daily cadence + one missed run = 48h worst case.           |
| Cultural events              | 90 min             | Hourly run MUST succeed 95%       | Events can appear / disappear fast; 90min is conservative. |
| OSM diffs                    | 7 h                | 6h cadence 95%                    | Compact bursts of editor activity — any one miss is fine.  |
| `crawler.command.*` one-offs | 30 s enqueue→start | 99%                               | Admin / API-triggered. Not on end-user hot path.           |
| `/v1/health`                 | 50 ms              | 99.9%                             |                                                            |

**Anti-SLO.** Never cross a source's rate limit. `rate_limit_breaches_total` must stay at **0** — a single breach pages the oncall because we can lose API access from the source.

---

## 4. Failure / degradation mode

Crawlers are the lowest-priority worker — if everything below falls over at once, user experience degrades gracefully (slightly stale prices, missing some events) but nothing user-facing breaks.

**Retry policy.** Per job class:

- **Scraper retry:** 3 attempts with exponential backoff, 60s / 5min / 30min. On 403 / 404 / 429 from the source, NO retry — move to DLQ and raise source-specific alert.
- **OSM Overpass retry:** 2 attempts with 5-minute gap. On sustained failure, skip this cycle and widen the `sinceWatermark` on the next cron run.

**Failure modes + fallbacks.**

| Failure                                  | Detection                                 | Fallback                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Playwright browser OOM                   | Pod OOMKilled / health check fails.       | k8s restart. Job returns to queue after lock TTL; next attempt has a fresh browser.                                                                                |
| Source site changes DOM (scraper breaks) | Zod validation on scraped payload fails.  | Job DLQ'd with `SCHEMA_DRIFT`. Alert fires → engineer updates the scraper. Stays serve last-known prices.                                                          |
| Source site rate-limits (429)            | Per-source 429 counter crosses threshold. | Circuit opens for that source for 1 h; other sources continue. Cadence halved on next cycle.                                                                       |
| Source ToS change / legal block          | 403 + 451 patterns in response body.      | Scraper for that source is DISABLED via feature flag (`FeatureFlag.scraper.<source>`). Manual re-enable.                                                           |
| Network partition                        | Scheduled run fails to enqueue.           | BullMQ's repeat-on-boot will backfill one run on next start. If partition persists, the freshness SLO degrades gradually; at 2× target staleness the worker pages. |
| Same event scraped twice                 | `sourceKey` dedupe hash in the result.    | Event downstream (Events module) short-circuits on duplicate sourceKey. No user-visible duplicates.                                                                |

**Egress budget.** Playbook §8.5 notes every external API has a free-tier limit. The worker's BullMQ limiter (`@app/ratelimit`) enforces them at enqueue time:

- Overpass: ≤ 10,000 req/day
- Booking public: ≤ 500 req/hour/IP
- Meetup: ≤ 200 req/hour/key

Breaches are hard — exceed means we're locked out for 24 h+ and the SLO goes to hell. The limiter counts against these directly.

**Runbook pointer.** `docs/runbooks/runbook-scraper-dom-drift.md`, `docs/runbooks/runbook-source-rate-limited.md` (both in `[VIII.31.4]`).

**Consumer expectations.** Modules that consume crawler-published events (Stays, Events, Places) MUST:

1. Treat every event as "new snapshot" — do not attempt to diff against the previous state beyond what the event carries.
2. Never assume ordering across different event types (prices and events scrapers are independent).
3. Use the `sourceKey` fields as the dedupe anchor when inserting into their own tables.

---

## Links

- [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) — worker extraction rationale (browser memory isolation + scheduled lifecycle).
- [context-map §Stays, §Events, §Places](../../architecture/context-map.md) — subscribers of the published events.
- [ADR-003](../../adr/ADR-003-event-backbone.md) — Redis Streams transport for outbound events.
- Playbook §8.5 — external APIs + free-tier caps the egress limiter enforces.
