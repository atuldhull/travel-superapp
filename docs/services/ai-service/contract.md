# ai-service contract

> Python 3.12 + FastAPI + Ray Serve sidecar. Hosts the ML stack that Node can't run natively: NLLB-200 translation, Whisper STT, DistilBERT fake-review classifier, crowd-prediction models, and embedding generation. Consumed by `apps/api` via `@app/ai` (port-first adapter landing in `[IV.18.2.11]`).
>
> Installed by prompt `[II.7.3]`. See [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) (why ai-service is extracted) and [context-map](../../architecture/context-map.md) §Translation for consumers.

---

## 1. Transport

**Primary: gRPC** with `protoc-gen-ts` client generation for Node consumers. Chosen over REST for:

- Streaming (Whisper STT is a stream of audio chunks → partial transcripts).
- Typed schemas shared across Python ↔ TS via the `.proto` IDL — single source of truth.
- Lower per-RPC overhead when the sidecar is doing multiple back-to-back ML calls per trip generation.

**Secondary: REST + JSON** on the same FastAPI app for:

- Browser debugging (`curl` in dev).
- Non-streaming endpoints that benefit from HTTP cache semantics (translation cache hits, embedding lookups).

**Auth.** mTLS between `apps/api` and `ai-service` in staging/production — internal service, no external ingress. In dev, plain HTTP behind `AI_SERVICE_URL=http://localhost:8001`.

**Backpressure.** Ray Serve enforces per-model replica concurrency. `apps/api`'s adapter adds a client-side semaphore capped at 16 in-flight calls per API pod.

---

## 2. Endpoints / Topics

Zod schemas are authored in `@app/shared-types` and mirrored to Python pydantic models by the codegen in `[IV.18.2.11]`. The schemas below are the TS source of truth; any drift fails CI.

### `POST /v1/translate` (REST) / `Translate` (gRPC unary)

```ts
export const TranslateRequest = z.object({
  sourceLang: z.string().length(2).describe('ISO-639-1'),
  targetLang: z.string().length(2),
  text: z.string().min(1).max(4_000),
  domain: z.enum(['general', 'food', 'navigation', 'safety']).optional(),
});
export const TranslateResponse = z.object({
  text: z.string(),
  modelVersion: z.string(), // e.g. "nllb-200-distilled-600M@2024-10-12"
  cacheHit: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
});
```

### `POST /v1/stt` (gRPC server-streaming only)

Input: a stream of `STTChunk { audio: bytes; sampleRateHz: int; final: bool }`.
Output stream: `STTPartial { text: string; isFinal: bool; confidence: float }`.
Whisper small-v3 runs on GPU when available, CPU fallback otherwise (flagged in `STTReady` handshake).

### `POST /v1/fake-review/score` (REST)

```ts
export const FakeReviewScoreRequest = z.object({
  reviews: z
    .array(
      z.object({
        id: z.string(),
        authorId: z.string(),
        body: z.string().min(1).max(8_000),
        postedAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(100),
});
export const FakeReviewScoreResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(1), // 1.0 = highly likely fake
      label: z.enum(['real', 'suspicious', 'fake']),
      reasons: z.array(z.string()).max(4),
    }),
  ),
});
```

### `POST /v1/crowd/predict` (REST)

```ts
export const CrowdPredictRequest = z.object({
  placeId: z.string(),
  timestamp: z.string().datetime(),
});
export const CrowdPredictResponse = z.object({
  density: z.enum(['empty', 'light', 'busy', 'packed']),
  densityScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  features: z.object({
    dayOfWeek: z.number(),
    hourOfDay: z.number(),
    isHoliday: z.boolean(),
  }),
});
```

### `POST /v1/embeddings` (REST — batched)

```ts
export const EmbeddingsRequest = z.object({
  inputs: z.array(z.string().min(1).max(2_000)).min(1).max(64),
  purpose: z.enum(['place', 'review', 'query']),
});
export const EmbeddingsResponse = z.object({
  model: z.string(),
  dimensions: z.literal(1024),
  embeddings: z.array(z.array(z.number())), // outer[i].length === dimensions
});
```

### `GET /v1/health` (REST)

Liveness. Returns `{status: "ok", ray: {replicas: int, healthy: int}}` within 200 ms; used by `HttpPingIndicator` once ai-service is added to `/health/ready` (see `[IV.18.1.16]`).

---

## 3. SLO

| Endpoint                | p95 latency         | p99 latency | Availability (monthly) | Notes                                                            |
| ----------------------- | ------------------- | ----------- | ---------------------- | ---------------------------------------------------------------- |
| `/v1/translate`         | 180 ms (cache hit)  | 900 ms      | 99.9%                  | Hot-path of itinerary generation. Cache hits must dominate.      |
| `/v1/translate` (miss)  | 900 ms              | 2.5 s       | 99.9%                  | NLLB cold inference.                                             |
| `/v1/stt` (stream)      | first-partial < 1 s | < 2.5 s     | 99.5%                  | Measured first-partial, not total-duration. Whisper small-v3.    |
| `/v1/fake-review/score` | 300 ms              | 1 s         | 99.5%                  | Batch of up to 100 reviews.                                      |
| `/v1/crowd/predict`     | 60 ms               | 200 ms      | 99.9%                  | In-memory model; hot path for map rendering.                     |
| `/v1/embeddings`        | 250 ms              | 900 ms      | 99.9%                  | Batch up to 64. Indexing jobs are offline; no user wait.         |
| `/v1/health`            | 50 ms               | 200 ms      | 99.99%                 | Probe. If this slips, the /ready gate in apps/api will flip red. |

**Error budget.** 99.9% = ~43 min/month. One Sev-2 outage burns half the budget — wake the oncall on any 10-minute sustained breach.

---

## 4. Failure / degradation mode

Every consuming port in `apps/api` wraps ai-service calls in a **circuit breaker** (opossum) with:

- 1 s hard timeout per unary call, 5 s for streaming.
- Open after 5 consecutive failures OR 50% error rate over the last 30 s.
- Half-open probe every 10 s.
- Fallbacks per endpoint:

| Endpoint                | Fallback when circuit is open                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/v1/translate`         | Return the source text verbatim with `modelVersion: "fallback-identity"`. Mark the trip's UI "translation unavailable". |
| `/v1/stt`               | Surface a client-side `STT_UNAVAILABLE` error. Mobile falls back to the OS's own STT.                                   |
| `/v1/fake-review/score` | Return `score: 0, label: "real"` (safe optimistic). Flag the review for async re-scoring when the service returns.      |
| `/v1/crowd/predict`     | Return `density: "light", confidence: 0`. Hide the crowd overlay in the UI.                                             |
| `/v1/embeddings`        | Defer the job. The caller MUST have an enqueue path — never block a trip on embeddings.                                 |

**Runbook pointer.** [`docs/runbooks/runbook-ai-service-down.md`](../../runbooks/) (to be authored in `[VIII.31.4]`). Graceful degradation: cache last itinerary, template fallback, as §31.4 already flags.

**Consumer expectations.** Every call through the port MUST:

1. Propagate the current trace context (see [`runWithTraceContext`](../../../packages/logger/src/trace-context.ts)).
2. Be idempotent at the adapter layer. Retries are safe on `/v1/translate`, `/v1/fake-review/score`, `/v1/crowd/predict`, `/v1/embeddings`. They are **not** safe on `/v1/stt` (streaming).
3. Log `ai_service_call` with endpoint + latency + outcome. Metrics via `@app/observability` counters `ai_service_calls_total`, `ai_service_errors_total`, `ai_service_latency_seconds`.

---

## Links

- [ADR-002](../../adr/ADR-002-service-extraction-triggers.md) — why ai-service is one of the four extracted services.
- [context-map §Translation](../../architecture/context-map.md) — Translation context consumes this via `TranslationPort`.
- [package-manifest §@app/events](../../packages/manifest.md) — ai-service forbidden from TS `@app/*` packages (Python runtime).
- Prompt `[IV.18.2.11]` — skeleton implementation + shared-types codegen.
