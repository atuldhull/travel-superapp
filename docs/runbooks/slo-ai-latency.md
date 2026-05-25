# Runbook — AI-endpoint p95 latency SLO breach

**Fires:** `ApiP95AiLatencyHigh` (ticket).
**Target:** p95 < 8 s for routes matching `.*ai.*|.*plan.*|.*memory-book.*`, 15 m window.
**Reality:** the upstream LLM (Anthropic / Gemini / Ollama) dominates this number. Most fixes are routing / fallback, not in-process.

## Triage script

### 1. Which provider is being used?

The api boots a 4-tier fallback chain in `apps/api/src/modules/trip/trip.module.ts`:

```
ANTHROPIC_API_KEY → ClaudeTripPlannerAdapter
↓ else if
GEMINI_API_KEY    → GeminiTripPlannerAdapter
↓ else if
OLLAMA_URL        → OllamaTripPlannerAdapter
↓ else
                   StubTripPlannerAdapter (deterministic, <50ms)
```

```bash
fly ssh console --app travel-api -- env | grep -E 'ANTHROPIC|GEMINI|OLLAMA'
```

The TOP env var with a value wins. If Anthropic is set + slow, the
api is locked in on Anthropic until you `fly secrets unset` it.

### 2. Is the upstream provider's status page red?

| Provider  | Status page                      |
| --------- | -------------------------------- |
| Anthropic | https://status.anthropic.com/    |
| Google    | https://status.cloud.google.com/ |
| Ollama    | self-hosted — `curl $OLLAMA_URL` |

If yes → flip to the next tier:

```bash
# Temporarily disable Anthropic; api auto-falls through to Gemini.
fly secrets unset ANTHROPIC_API_KEY --app travel-api
# Or stub everything out:
fly secrets unset ANTHROPIC_API_KEY GEMINI_API_KEY OLLAMA_URL --app travel-api
fly deploy --app travel-api  # restart picks up the new envs
```

### 3. Is OUR rate limit being hit?

Anthropic returns 429 with a `retry-after` header. Search logs:

```bash
fly logs --app travel-api | grep -iE '429|rate.?limit|quota'
```

If yes → either bump the plan, or shed load by gating
`/api/v1/plan` behind a feature flag for free-tier users.

### 4. Is the input getting larger?

LLM latency scales with prompt size. Check whether a recent prompt
template change ballooned the context:

```bash
git log --oneline -10 -- apps/api/src/modules/trip/infrastructure/{claude,gemini,ollama}-trip-planner.adapter.ts
```

If a recent commit grew the prompt 2-3x, latency at p95 will follow.
Cap the input — most travel-plan prompts fit in 4k tokens.

## Fix patterns

| Pattern                            | Fix                                                                 |
| ---------------------------------- | ------------------------------------------------------------------- |
| Single provider is degraded        | Unset its key → auto-fallback to next tier                          |
| Free-tier rate limit hit           | Shed load: gate AI routes by user tier; or bump plan                |
| Prompt size regressed              | Revert the template change; cap to N tokens at the adapter          |
| Network slow to a cloud provider   | Switch to local Ollama via `OLLAMA_URL` (free-tier degraded mode)   |
| Burnout from many concurrent users | Apply per-user throttle to `/api/v1/plan` ([N9] edge rate limiting) |

## Why this is NEVER a page

AI endpoints have inherent latency tail — the LLM can choke for 20 s
on a hairy prompt and we'd see a brief p95 spike. The SLO is
generous (8 s) so a 15-minute alert IS signal worth investigating
during business hours. We don't wake up an on-call for AI latency.

A separate alert would be warranted if AI endpoints START 500ing
in bulk (covered by `ApiAvailabilityBurnFast` general burn alert).
