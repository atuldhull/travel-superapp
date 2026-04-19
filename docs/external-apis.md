# External APIs Registry

> One row per external provider the product depends on. Source of truth when reviewing a PR that adds / bumps / removes an external dep. Every column is binding — if a provider's free-tier moves, a PR updates this file AND the matching env var AND the circuit-breaker config in the same commit.
>
> Installed by prompt `[II.8.5]`. Source: Playbook [§8.5 External APIs](../travel-app-playbook.md).

---

## How to read this doc

- **Purpose** — the one-line product reason we depend on this provider. If the purpose disappears, the row is deleted.
- **Base URL** — the production endpoint; dev stubs live separately in `apps/api/test/stubs/`.
- **Auth type** — `api_key` (header or query param), `oauth2`, `mtls`, or `none` (public endpoint).
- **Free-tier limits** — the monthly cap we get for $0. Snapshot as of 2026-04 — providers change these. Re-verify every quarter.
- **Cost beyond free** — the step-up price. Relevant for budget-alarm thresholds ([Playbook §21.4](../travel-app-playbook.md)).
- **Adapter port name** — the TS interface in `apps/api/src/modules/<owner>/application/ports/` that wraps this provider. Callers depend on the port, never the SDK directly ([ADR-004](./adr/ADR-004-bounded-contexts.md)).
- **Circuit breaker** — `(failure-threshold) / (rolling window) / (open-to-half-open delay)` + the fallback when open.

---

## Registry

### Maps + 3D tiles

| Name            | Purpose                           | Base URL                                  | Auth    | Free tier             | Beyond free         | Adapter port      | Circuit breaker                                                                    |
| --------------- | --------------------------------- | ----------------------------------------- | ------- | --------------------- | ------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| **Mapbox**      | Primary vector tiles + directions | `https://api.mapbox.com/`                 | api_key | 50,000 map loads / mo | $0.50 / 1,000 loads | `MapsTilesPort`   | 5 failures / 30s / 60s half-open. Fallback → cached tiles + "offline mode" banner. |
| **Google Maps** | 3D photorealistic tiles (premium) | `https://tile.googleapis.com/v1/3dtiles/` | api_key | $200 free credit / mo | Pay-per-use         | `Maps3DTilesPort` | 3 failures / 30s / 120s half-open. Fallback → 2D Mapbox tiles.                     |

### Places data (federated)

| Name                     | Purpose                     | Base URL                                  | Auth    | Free tier                             | Beyond free           | Adapter port              | Circuit breaker                                                             |
| ------------------------ | --------------------------- | ----------------------------------------- | ------- | ------------------------------------- | --------------------- | ------------------------- | --------------------------------------------------------------------------- |
| **Google Places (New)**  | Primary place metadata      | `https://places.googleapis.com/v1/`       | api_key | $200 credit / mo (~17k basic lookups) | Pay-per-use           | `PlacesLookupPort#google` | 5 failures / 60s / 120s. Fallback → Foursquare + OSM.                       |
| **Foursquare Places v3** | Secondary dedup + rich tags | `https://api.foursquare.com/v3/`          | api_key | 100,000 req / mo                      | $0.004 / req          | `PlacesLookupPort#fsq`    | 5 failures / 60s / 120s. Fallback → OSM only; degraded tag coverage.        |
| **OSM Overpass**         | Tertiary + offline pack     | `https://overpass-api.de/api/interpreter` | none    | ~10,000 req / day (fair use)          | Host our own Overpass | `PlacesLookupPort#osm`    | 3 failures / 60s / 5min. Fallback → last-known snapshot; crawler backfills. |

### Hotels / stays

| Name                      | Purpose                                  | Base URL                                | Auth    | Free tier                     | Beyond free             | Adapter port             | Circuit breaker                                                          |
| ------------------------- | ---------------------------------------- | --------------------------------------- | ------- | ----------------------------- | ----------------------- | ------------------------ | ------------------------------------------------------------------------ |
| **Booking.com Affiliate** | Primary hotel search + affiliate revenue | `https://distribution-xml.booking.com/` | api_key | Free (rev-share)              | Revenue share, not cost | `StaysQueryPort#booking` | 3 failures / 60s / 5min. Fallback → Amadeus; last-known stay list shown. |
| **Amadeus Self-Service**  | Secondary + flights (later)              | `https://api.amadeus.com/v1/`           | oauth2  | 1,000 requests / mo (sandbox) | Tier-based              | `StaysQueryPort#amadeus` | 3 failures / 60s / 5min. Fallback → Booking only.                        |

### Weather + environment

| Name               | Purpose                    | Base URL                                   | Auth    | Free tier                                             | Beyond free        | Adapter port            | Circuit breaker                                                         |
| ------------------ | -------------------------- | ------------------------------------------ | ------- | ----------------------------------------------------- | ------------------ | ----------------------- | ----------------------------------------------------------------------- |
| **Open-Meteo**     | Primary weather + UV + AQI | `https://api.open-meteo.com/v1/`           | none    | Unlimited for non-commercial; commercial tier ~€29/mo | Tiered             | `WeatherPort#openMeteo` | 5 failures / 60s / 120s. Fallback → OpenWeatherMap.                     |
| **OpenWeatherMap** | Secondary weather          | `https://api.openweathermap.org/data/3.0/` | api_key | 1,000 calls / day                                     | $40/mo for 10k/d   | `WeatherPort#owm`       | 5 failures / 60s / 120s. Fallback → cached last-known for the geo cell. |
| **WAQI (Air)**     | Secondary air-quality      | `https://api.waqi.info/feed/`              | api_key | 1,000 calls / day                                     | Contact for higher | `WeatherPort#waqi`      | 3 failures / 60s / 300s. Fallback → suppress AQI layer on map.          |

### Satellite + crowd

| Name                                   | Purpose                                      | Base URL                             | Auth    | Free tier                    | Beyond free      | Adapter port           | Circuit breaker                                             |
| -------------------------------------- | -------------------------------------------- | ------------------------------------ | ------- | ---------------------------- | ---------------- | ---------------------- | ----------------------------------------------------------- |
| **Sentinel Hub (ESA)**                 | Satellite imagery for crowd-density ML input | `https://services.sentinel-hub.com/` | oauth2  | 30,000 processing units / mo | Paid PU packages | `CrowdImageryPort#sh`  | 3 failures / 5min / 15min. Fallback → last-week's snapshot. |
| **Google Popular Times (via SerpAPI)** | Secondary crowd signal                       | `https://serpapi.com/`               | api_key | 100 searches / mo            | $50/mo for 5,000 | `CrowdImageryPort#pop` | 5 failures / 60s / 300s. Fallback → omit the crowd overlay. |

### Crime / safety

| Name                                   | Purpose                              | Base URL                      | Auth    | Free tier       | Beyond free       | Adapter port             | Circuit breaker                                                                        |
| -------------------------------------- | ------------------------------------ | ----------------------------- | ------- | --------------- | ----------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| **Numbeo**                             | Primary crime-index + cost-of-living | `https://www.numbeo.com/api/` | api_key | ~1,000 req / mo | Custom enterprise | `SafetyQueryPort#numbeo` | 3 failures / 60s / 300s. Fallback → government-open-data feeds + user reports.         |
| **Government open data** (per-country) | Secondary crime incidents            | Varies per country            | none    | Varies          | Varies            | `SafetyQueryPort#gov`    | Per-feed 3 failures / 5min / 30min. Fallback → omit that feed; surface banner on city. |

### Payments

| Name       | Purpose                                   | Base URL                     | Auth             | Free tier                       | Beyond free       | Adapter port   | Circuit breaker                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------- | ---------------------------- | ---------------- | ------------------------------- | ----------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe** | Primary: Subs + Connect escrow + webhooks | `https://api.stripe.com/v1/` | api_key (secret) | No cap; per-tx fee 2.9% + $0.30 | Volume-negotiable | `PaymentsPort` | **No circuit breaker — retry with idempotency key.** Stripe's own infra is more reliable than ours; failing closed on a checkout is worse than waiting. On sustained 5xx > 5 min, surface "We're having trouble processing payments" + preserve the cart. |

### Communications

| Name                       | Purpose                   | Base URL                             | Auth    | Free tier                             | Beyond free               | Adapter port | Circuit breaker                                                                                                          |
| -------------------------- | ------------------------- | ------------------------------------ | ------- | ------------------------------------- | ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Resend**                 | Transactional email       | `https://api.resend.com/emails`      | api_key | 3,000 emails / mo                     | $20/mo for 50k            | `EmailPort`  | 5 failures / 60s / 120s. Fallback → DLQ in notification-worker ([contract](./services/notification-worker/contract.md)). |
| **Twilio**                 | SMS                       | `https://api.twilio.com/2010-04-01/` | api_key | Free trial credit                     | $0.0075/SMS in US; varies | `SmsPort`    | 3 failures / 60s / 120s. DLQ for retry. No channel failover (Playbook §13.2 — no silent reroute of PII).                 |
| **Expo Push / FCM / APNs** | Mobile push notifications | Expo/FCM/APNs endpoints              | api_key | Free (Expo + FCM); APNs requires cert | Free for routine volumes  | `PushPort`   | 3 failures / 30s / 60s. DLQ; escalate to email if rule has that channel.                                                 |

---

## Shared circuit-breaker policy

Every circuit above follows the same `opossum`-based shape, parameterised per provider:

- **States:** `closed` → `open` (on N consecutive failures OR 50% error rate over rolling window) → `half-open` (after cooldown) → `closed` (on one successful probe).
- **Timeout:** per-provider hard timeout, not inherited. Default 3 seconds.
- **What counts as a failure:** HTTP 5xx, network error, timeout. 4xx (including 429) does NOT open the circuit — those are _our_ bugs / quota issues, not a provider outage.
- **429 handling:** provider-specific. We respect `Retry-After` via the client, AND feed the event into a per-provider rate-limit counter. Two 429s in a row from a non-Google provider is a warning; from Google it's a real concern and we slow down globally.
- **Observability:** every state transition publishes `external_api_circuit_<provider>_<state>` counter + a log line at WARN.

Runbook: [`docs/runbooks/runbook-external-api-degraded.md`](./runbooks/) — the oncall playbook when two+ providers are open simultaneously (hint: they usually share a CDN provider).

---

## How to add a new provider

1. Add a row to the matching section above, filling every column. Rows without a named adapter port don't ship.
2. Add the env var(s) to `packages/config/src/schema.ts` (optional by default, required by provider-specific feature flag).
3. Add the env example to `.env.example` and a row to `docs/env.md`.
4. Build the adapter in the owning module's `infrastructure/` layer, implementing the port.
5. Wire the port through NestJS DI; register the module. The calling use-case imports the port interface, never the SDK.
6. Write a unit test with the SDK mocked + an integration test against the provider's documented sandbox (if one exists).
7. Add a one-line provider-specific alert rule in `docs/runbooks/` if the provider is critical-path.

## How to remove a provider

1. Delete the row from this file.
2. Remove the adapter file.
3. Remove the env var from schema + `.env.example` + `docs/env.md`.
4. Flip any port's default binding away from the removed adapter.
5. Open a superseding ADR if removing the provider changes a product capability (e.g. "we no longer serve AQI data").

---

## Links

- Playbook [§8.5 External APIs](../travel-app-playbook.md) · [§21.4 Budget alarms](../travel-app-playbook.md).
- [ADR-004](./adr/ADR-004-bounded-contexts.md) — adapters live in the owning module; callers depend on the port, not the SDK.
- [`docs/packages/manifest.md`](./packages/manifest.md) — adapters may import `@app/cache` + `@app/ratelimit` + `@app/logger`; they may NOT import other modules' internals.
- [`docs/services/notification-worker/contract.md`](./services/notification-worker/contract.md) — DLQ destination for failed email/SMS/push.
- [`docs/services/crawler-worker/contract.md`](./services/crawler-worker/contract.md) — scheduled consumer of OSM Overpass + Booking.com public + events-scraper sources.
