# AI inference — scaling path

> **Installed by [Q10]** of the Scale-readiness 3→10 series. Companion to [`docs/external-apis.md`](../external-apis.md) (the fallback chain) + [`docs/runbooks/slo-ai-latency.md`](../runbooks/slo-ai-latency.md) (the SLO playbook) + [`packages/resilience/`](../../packages/resilience/) (circuit breakers).
>
> The Python `apps/ai-service` is a scaffold today — the schemas + the routing contract exist, the inference code does not. This doc is the **plan for when it does**, not a claim that it already scales. Implementation is gated behind a future prompt; this document is the architecture decision in advance.

## What "AI inference" means in this codebase

Three classes of work touch a model:

| Class                  | Provider chain (today)                    | Latency budget | Volume shape                                    |
| ---------------------- | ----------------------------------------- | -------------- | ----------------------------------------------- |
| **Trip planning**      | Anthropic → Gemini → Ollama → static stub | < 8s p95 (SLO) | low frequency, deep prompt                      |
| **Diary continuation** | Anthropic → Gemini → Ollama → static stub | < 8s p95 (SLO) | bursty per-user during trip                     |
| **Translation / OCR**  | Gemini → Ollama → static                  | < 1s p95       | high frequency, short prompt                    |
| **Embeddings**         | Ollama (`mxbai-embed-large`) → OpenAI?    | < 200ms p95    | very high frequency (every place catalog write) |

All four currently land on **the api process** via the `@app/resilience`-wrapped adapters (from O1). The Python `ai-service` would take over once it's real — that's what the rest of this doc plans for.

## The four scaling levers

### 1. Batching

Embeddings are the win here. Right now Ollama serves them one at a time over HTTP. Batching 64 requests into one round-trip drops latency by ~10× and throughput by ~5× (Ollama's serial decode is the floor — batching doesn't help when each request hits a different shape).

**Implementation when ai-service ships:**

```python
# Pseudocode for the embedding endpoint
@app.post('/embed')
async def embed(batch: list[EmbedRequest]) -> list[EmbedResponse]:
    # Coalesce up to N=64 incoming requests, max wait 10ms
    accumulated = await collector.collect(batch, max_size=64, max_wait_ms=10)
    return await model.embed_batch([r.text for r in accumulated])
```

The Node side already queues — when [Q3]'s BullMQ wraps embedding work via the `places-embed` queue, the worker batches per-tick. Document the trade-off: latency-coalescing window of 10ms hides under typical request RTTs but adds bounded p99.

### 2. Concurrency limits (the kind that DON'T break things)

Without batching, the next lever is "how many in-flight inferences can one process run." For LLM SDK calls (Anthropic / Gemini): the limit is the provider's rate-limit, not our CPU. Today `@app/resilience` enforces it via per-adapter circuit breakers + token-bucket on the Anthropic adapter — that's the right shape; bump the rate-limit when we have headroom.

For Ollama (self-host) the limit is the GPU's VRAM / sequence-length. **One inference per GPU at a time** is the safe default; queuing handles the rest. Don't try to parallelise on one GPU without batching — it serialises anyway and adds context-switch overhead.

### 3. Caching (semantic + exact)

Per `docs/runbooks/cache-collapse.md`, every read-heavy AI surface has a cache layer:

- **Translation** — exact-match cache by `(text, target_lang)` in Redis, 7-day TTL. Common phrases ("How much?", "Where is the bathroom?") hit ~80% of the time.
- **Trip planning** — semantic cache: hash the user prompt + trip parameters; if a "close enough" plan exists (cosine similarity > 0.95 via pgvector), serve it. Operator-tunable threshold per [O3 runbook (forthcoming)].
- **Embeddings** — exact cache by source text. Place catalog re-crawl is idempotent — same description = same embedding = cache hit.

Caching is the biggest single lever. A 50% cache hit ratio cuts the LLM bill in half AND latency by ~10× for cache hits.

### 4. Provider fallback (already shipped in O1)

When Anthropic is slow / down, the circuit-breaker opens and the request falls to Gemini. When Gemini is slow / down, it falls to Ollama. When Ollama is also down, the static stub returns a sensible default. The full chain is documented in [`docs/external-apis.md`](../external-apis.md#ai--llm-providers).

The cost of cascading is latency — the breaker has to detect failure first. The `@app/resilience` package is tuned at 5 failures / 30s window → open for 30s. Tuning the threshold downward (more sensitive) trades fewer cascaded fails for more false-positive breaks during transient blips.

## GPU strategy

When self-hosted (Ollama) inference becomes the hot path:

| Option                                    | $/month (est)              | Throughput | Best for                                         |
| ----------------------------------------- | -------------------------- | ---------- | ------------------------------------------------ |
| **CPU-only (current Fly machine)**        | $0 marginal                | ~0.5 tok/s | dev + cold fallback only                         |
| **Fly GPU machine** (A10, on-demand)      | ~$100                      | ~50 tok/s  | first paid AI tier                               |
| **RunPod GPU pod** (A100 spot)            | ~$200/mo @ 30% utilisation | ~150 tok/s | second tier, batched embeddings                  |
| **Vendor inference API** (Together, Groq) | per-token                  | ~200 tok/s | "burst" handling without a GPU procurement story |

For embeddings specifically, batched Ollama on a single A10 handles 10k embeddings/hour at <100ms p95. That covers the catalog re-crawl traffic for the foreseeable future.

For trip-planning, Anthropic / Gemini's paid endpoints are cheaper per request than a dedicated GPU until volume exceeds ~50k requests/day. Past that, a local Ollama deployment on RunPod becomes the cost winner.

## Concurrency model in ai-service

When `apps/ai-service` lands (future prompt [IV.18.2.11]):

- **Stateless** — same rule as the api (Q8). Per-request state stays in the HTTP body or in Redis.
- **Async-friendly** — FastAPI + `asyncio` so a single worker can wait on a remote LLM call without blocking sibling requests. Uvicorn `--workers` controls the process count.
- **Ray Serve** — the README mentions Ray Serve; useful if we add multiple model variants behind one router (e.g. "small model for first-pass, large for refinement"). Out of scope until that pattern shows up.
- **Health probes** — `/health/live` + `/health/ready` exactly mirroring the api ([Q4] worker pattern). Ready includes a model warm-up status (loaded → ready).
- **OTLP traces** — every request carries trace context from the api caller; the ai-service spans link back to the parent request. Already wired in `@app/observability`.

## Observability — what to watch

The [`external-resilience.json`](../../ops/observability/grafana/dashboards/external-resilience.json) dashboard already shows AI route p95 by route. Extensions when ai-service is live:

- **Tokens-per-second** — per provider, per region. The first cliff in this number tells you a provider is overloaded.
- **Cache hit ratio** — per AI surface. Below 30% = retune the cache (semantic threshold too tight, or TTL too short).
- **Cost-per-request** — Anthropic / Gemini both expose `usage` in the response; the api should log + sum it per route. Feeds [Q11]'s cost-per-user model.
- **Provider circuit-breaker state** — already tracked via `circuit_state_change` log channel from O1.

## When to start implementing

A future prompt — likely [IV.18.2.11] per the existing scaffolding plan. Triggers:

- Embedding traffic exceeds 1k/hour sustained (Ollama on the api machine starts blocking other work).
- Trip planning p95 routinely > 8s.
- A specific use case wants a model the major providers don't ship (custom fine-tune).

Until one of those fires, the api-side adapters from O1 are the right shape.

## Operator-owed

1. **Decide on a paid AI fallback** when Anthropic + Gemini both quota-out (or when paying per-token is preferable to running our own GPU). Operator decision tied to growth.
2. **Procure a GPU** before any heavy self-hosted inference launch. The numbers above are starting points; measure once a real workload exists.
3. **Per-provider spending caps** — already documented in `docs/runbooks/cost-monitoring.md` (N11). Required before flipping any paid AI key live in prod.

## See also

- [`apps/ai-service/README.md`](../../apps/ai-service/README.md) — current scaffold + implementation roadmap
- [`packages/shared-types/scripts/emit-pydantic.mjs`](../../packages/shared-types/scripts/emit-pydantic.mjs) — Zod → Pydantic bridge (the contract is real already)
- [`docs/external-apis.md`](../external-apis.md) — every AI provider + free-tier limits + fallback behaviour
- [`docs/runbooks/slo-ai-latency.md`](../runbooks/slo-ai-latency.md) — what to do when AI latency breaches
- [`docs/runbooks/runbook-external-api-degraded.md`](../runbooks/runbook-external-api-degraded.md) — breaker map + triage
- [`packages/resilience/`](../../packages/resilience/) — circuit breakers + token buckets
- [`docs/perf/capacity-matrix.md`](../perf/capacity-matrix.md) — AI surfaces in the per-class budget
- [`docs/finance/cost-per-user.md`](../finance/cost-per-user.md) — the cost side ([Q11])
