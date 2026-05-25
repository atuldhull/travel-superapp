# Runbook — External API degraded (circuit breaker open)

> **Installed by [O4]** to close a dangling cross-ref in
> `incident-response.md`. Documents the breaker-open playbook for
> the 13 external adapters wired in [N8] + [O1].

## When this runbook fires

Pager or ticket says one of:

- A specific feature is 5xx-ing or returning a stub ("AI plan
  generation failed; the deterministic itinerary stub is still
  available", "Email delivery failed", etc.).
- Sentry / Honeycomb spans show `circuit_state_change` log lines
  for a specific named breaker.
- The `external-resilience` Grafana dashboard ([O3]) shows
  503s on a specific route family that overlaps with one upstream.

## The breaker map

Every external adapter under `apps/api/src/modules/*/infrastructure/`
has a circuit breaker. Look up the upstream + the named breaker:

| Upstream       | Adapter file                                                         | Breaker name             | Threshold / openMs | Fallback                                        |
| -------------- | -------------------------------------------------------------------- | ------------------------ | ------------------ | ----------------------------------------------- |
| Open-Meteo     | `modules/weather/infrastructure/open-meteo-provider.ts`              | `open-meteo`             | 5 / 30s            | `CachedWeatherProvider` serves stale            |
| Anthropic      | `modules/trip/infrastructure/claude-trip-planner.adapter.ts`         | `anthropic`              | 4 / 60s            | Falls through Gemini → Ollama → Stub            |
| Gemini         | `modules/trip/infrastructure/gemini-trip-planner.adapter.ts`         | `gemini`                 | 4 / 60s            | Same fallback chain                             |
| Ollama (plan)  | `modules/trip/infrastructure/ollama-trip-planner.adapter.ts`         | `ollama-trip`            | 3 / 60s            | Same fallback chain                             |
| Ollama (embed) | `modules/feed/infrastructure/ollama-embedding.adapter.ts`            | `ollama-embedding`       | 3 / 60s            | Publish skips the index (still succeeds)        |
| OpenSky        | `modules/agent/infrastructure/opensky-flight.adapter.ts`             | `opensky`                | 5 / 60s            | `noChange()` — agent loop never breaks          |
| Resend         | `common/mailer/resend-mailer.adapter.ts`                             | `resend`                 | 5 / 30s            | `MailDeliveryError` — caller swallows / retries |
| Twilio (SMS)   | `modules/identity/infrastructure/twilio-sms-sender.adapter.ts`       | `twilio-sms`             | 5 / 60s            | Throws — caller decides                         |
| Twilio (SOS)   | `modules/safety/infrastructure/twilio-contact-notifier.adapter.ts`   | `twilio-sos`             | 5 / 60s            | Email-only contacts still notified              |
| Stripe         | `modules/payments/infrastructure/stripe-payment-provider.adapter.ts` | `stripe`                 | 4 / 60s            | 503 from /payments/checkout                     |
| TomTom         | `modules/transport/infrastructure/tomtom-traffic-provider.ts`        | `tomtom`                 | 5 / 60s            | `MockTrafficProvider` (no live data)            |
| OSRM           | `modules/transport/infrastructure/osrm-navigation-provider.ts`       | `osrm`                   | 5 / 60s            | `MockNavigationProvider` (mock route)           |
| LLM-diary      | `modules/diary/infrastructure/llm-diary-assistant.ts`                | `diary-{gemini\|ollama}` | 4 / 60s            | Heuristic prompts/title/polish                  |
| S3 / R2        | `modules/media/infrastructure/s3-storage-provider.ts`                | `s3`                     | 8 / 30s            | Throws — caller decides                         |

## Triage script

### 1. Identify which breaker opened

```bash
fly logs --app travel-api-prod --since=15m \
  | grep -i circuit_state_change \
  | tail -20
```

The log entry shape:

```
{"from":"closed","to":"open","name":"<breaker-name>","msg":"circuit_state_change"}
```

Cross-reference `name` against the table above.

### 2. Check the upstream's status page

| Breaker    | Status page                                           |
| ---------- | ----------------------------------------------------- |
| open-meteo | https://status.open-meteo.com/                        |
| anthropic  | https://status.anthropic.com/                         |
| gemini     | https://status.cloud.google.com/                      |
| ollama-\*  | self-hosted; `curl $OLLAMA_URL`                       |
| opensky    | https://opensky-network.org/                          |
| resend     | https://status.resend.com/                            |
| twilio-\*  | https://status.twilio.com/                            |
| stripe     | https://status.stripe.com/                            |
| tomtom     | https://status.tomtom.com/                            |
| osrm       | depends on host (project-osrm.org demo / self-hosted) |
| s3         | https://www.cloudflarestatus.com/ (R2) or AWS S3      |

### 3. Is the fallback path holding?

Each adapter's fallback (see table) is what users actually see
during the open window. Confirm via the `external-resilience`
dashboard ([O3]):

- **5xx by route panel** — should NOT spike on routes that have
  a fallback (planner, diary, transport, opensky). DOES spike
  on routes without a graceful fallback (stripe checkout, twilio).
- **p95 on AI/planner routes** — should DROP after breaker opens
  (the timeout is shortcut by the breaker).

If a route is 5xx-ing despite the breaker being open, the
fallback path itself is broken — file a SEV-2.

### 4. Wait or force-rollback?

Breakers self-recover: at `openMs` (30s or 60s), they enter
half-open + probe. If the upstream is back, the next call closes
the breaker. The runbook for "wait or roll back" is the same as
the availability runbook:

- Recent deploy + this breaker name appeared in the deploy diff
  → ROLLBACK (`flyctl releases rollback`).
- No recent deploy + the upstream status page is red → WAIT.
- Upstream status page is green + we're still seeing failures →
  investigate our adapter. Likely a regression to the request
  shape (auth header, encoding) that the breaker is masking.

## Manual reset

Today: NO manual reset endpoint. The breaker is per-instance
state; a `fly machine restart --app travel-api-prod <id>` resets
it. Wait the openMs window instead — restart is usually slower.

A future polish: add `POST /api/v1/admin/breakers/<name>/reset`
behind the existing Admin role. Not yet shipped; the LM cost
of writing this paragraph is less than the risk surface of an
unauthenticated reset endpoint.

## Cross-refs

- [`@app/resilience`](../../packages/resilience/) — the CircuitBreaker
  - callExternal primitives
- [`docs/runbooks/slo-availability.md`](slo-availability.md) — the broader pager
- [`docs/runbooks/slo-ai-latency.md`](slo-ai-latency.md) — AI-specific path
- [`docs/security/threat-model.md`](../security/threat-model.md) — what the
  fallbacks are protecting against
