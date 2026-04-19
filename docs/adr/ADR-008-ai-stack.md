# ADR-008 — AI stack: layered Anthropic routing + self-hosted NLLB / Whisper / DistilBERT / Llama 3.1

- **Status:** Accepted
- **Date:** 2026-04-19
- **Prompt:** `[II.8.4]`
- **Playbook reference:** §21 (build-time token economics) + §22 (runtime LLM economics)

## Context

TravelSuperApp is AI-native — itinerary generation, live re-plan, translation, STT, fake-review scoring, crowd prediction, and semantic search all run through some form of ML. Playbook §22.3 makes the hard claim: **you need caching + Haiku routing to be profitable below 5% Pro conversion**. That cost-shape forces four architectural decisions up front:

1. **Which Anthropic tier per task.** Sending every chat message to Opus burns the margin; sending a "generate itinerary for Tokyo" call to Haiku ships garbage.
2. **Which models are self-hosted.** Translation × 100 calls/user/month is the dominant volume — that has to be free at the margin. Same for fake-review scoring and embeddings.
3. **Prompt caching strategy.** Without it, Anthropic costs triple (§21.1 — "$60–120 without prompt caching" vs. "$20–40 with").
4. **Fallback chain when the Anthropic API is down.** One provider outage cannot mean no itinerary generation. Playbook §22.3 + §31.4 agree: graceful degradation or we lose the user.

This ADR locks the answers to all four.

## Decision drivers

- **Margin-before-quality where it's safe.** Haiku for chat-suggestion / template-match / low-stakes pattern matching. Sonnet as the workhorse. Opus only where ambiguity + architectural judgment demand it.
- **Self-host what scales with user count.** Translation and fake-review are high-volume, low-complexity; NLLB / DistilBERT fit Node-compatible inference shapes well enough via our Python sidecar ([ADR-002](./ADR-002-service-extraction-triggers.md), [ai-service contract](../services/ai-service/contract.md)).
- **One provider-outage doesn't kill user flow.** Playbook §22.3 unit economics assume Anthropic is up. Reality says we need a fallback.
- **Prompt caching is a first-class design concern, not an optimisation we'll get to.** Cache layers are baked into the adapter at day 0.
- **Future-proof the open-weight lane.** Llama 3.1 is declared as a fine-tune target — not a day-1 serving model. Reserving the slot now keeps the adapter shape ready for when we want to shift itinerary generation off Anthropic entirely.

## Considered choices (each locked, each with one rejected alternative)

### 1. Runtime LLM router — **Anthropic 3-tier (Haiku 4.5 / Sonnet 4.6 / Opus 4.7)**

**Chosen.** A single adapter in `apps/api` (future `@app/ai`) takes a `TaskKind` enum and dispatches to the matching model. Every call site names its task, not its model; the router owns the mapping.

**Runtime routing table** (binding; changes require PR-level approval + cost impact analysis):

| Runtime task                              | Model                        | Why                                                                          |
| ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| Itinerary generation (cold)               | Sonnet 4.6                   | Mid-depth architectural judgment; cost sweet-spot for 12k-in / 8k-out calls. |
| Live re-plan (warm trip context in cache) | Sonnet 4.6                   | Context reuse hits the cache; same quality tier as cold gen.                 |
| Chat / edit suggestions                   | Haiku 4.5                    | Pattern matching; sub-second latency requirement; margin-critical.           |
| Trip title / summary                      | Haiku 4.5                    | Short-form generation; quality ceiling is fine.                              |
| Agent safety-check prompt rewriting       | Opus 4.7 + extended thinking | Safety-adjacent; reasoning errors hurt users. Opus earned.                   |
| Ambiguity resolution ("did user mean X?") | Opus 4.7                     | Real disambiguation; Opus's extra context handling matters.                  |

**Rejected alternative: single-model (Sonnet everywhere).** Simpler adapter, one SKU. But: §22.3 says "you need Haiku routing to be profitable below 5% conversion." Chat-suggestion volume is 20 calls/user/mo; Sonnet at that volume kills the margin. Single-model is the simplicity trap.

### 2. Translation — **Self-hosted NLLB-200** (via `ai-service`)

**Chosen.** NLLB-200 distilled-600M runs on the Python sidecar ([ai-service contract](../services/ai-service/contract.md) §`/v1/translate`). 100+ calls/user/month at near-zero marginal cost; translation is the dominant volume and has to be free at the margin (§22.2).

**Rejected alternative: Anthropic translate-via-prompt (or Google Translate API).** Simpler, no self-host. But translation is high-volume / low-reasoning — sending it to Sonnet wastes tokens and sending it to Google is an external egress bill we can predict. NLLB self-host breaks even at ~100k translations/month (runs on CPU); we cross that in month 2.

### 3. Speech-to-text — **Self-hosted Whisper small-v3** (via `ai-service`, gRPC stream)

**Chosen.** Whisper runs in `ai-service` ([contract §`/v1/stt`](../services/ai-service/contract.md)) — GPU when available, CPU fallback otherwise. Streams chunks → partial transcripts. Competitive quality, zero per-request cost.

**Rejected alternative: Groq / Deepgram API.** Faster p95 than our CPU-Whisper. But: STT is a premium feature — voice-to-itinerary flow on mobile — and the unit economics don't tolerate a paid external STT API. Re-evaluate if we switch Whisper to GPU-backed deployment AND Groq drops below $0.001/minute.

### 4. Fake-review classifier — **Self-hosted DistilBERT**

**Chosen.** DistilBERT fine-tuned on a review-authenticity dataset (scripted in `apps/ai-service/training/`), served via `/v1/fake-review/score` (batch up to 100 reviews per call). Inference is cheap; training is periodic.

**Rejected alternative: Anthropic classification prompt.** Would work. But with 5+ scorings per user/month, a Sonnet call per review is margin-negative; Haiku is good enough at single-review classification but fails on batched inference shape. DistilBERT batched is cheap, fast, and trainable on our own labelled data.

### 5. Future open-weight lane — **Llama 3.1** (70B-Instruct as fine-tune target)

**Chosen (reserved slot).** Not on the critical path today. Declared here so that when Anthropic costs outgrow our margin and we have a labelled itinerary-generation dataset, the adapter can already route `itinerary-generation` to a self-hosted Llama 3.1 behind the same `TaskKind` enum. No code changes to the domain — adapter swap only.

**Rejected alternative: Mistral Large / Mixtral 8x22B.** Close quality-tier competitor. Either could be our open-weight lane. Llama 3.1 wins on ecosystem — fine-tuning tooling (Unsloth, Axolotl, TRL), quantisation (AWQ, GPTQ), serving (vLLM, TensorRT-LLM) — is more mature. Revisit if Meta's licensing changes.

## Summary

| #   | Layer                               | Chosen                                         | Rejected (one)                   |
| --- | ----------------------------------- | ---------------------------------------------- | -------------------------------- |
| 1   | Runtime LLM router                  | Anthropic 3-tier (Haiku / Sonnet / Opus)       | Single-model Sonnet everywhere   |
| 2   | Translation                         | Self-hosted NLLB-200 (in `ai-service`)         | Google Translate API / Anthropic |
| 3   | Speech-to-text                      | Self-hosted Whisper small-v3 (in `ai-service`) | Groq / Deepgram API              |
| 4   | Fake-review classifier              | Self-hosted DistilBERT (in `ai-service`)       | Anthropic classification prompt  |
| 5   | Open-weight fine-tune lane (future) | Llama 3.1 70B-Instruct                         | Mistral Large / Mixtral 8x22B    |

## Anthropic prompt-caching strategy (3 layers)

Direct carry-over from Playbook §21.2 but applied at **runtime**, not only build-time. Every Anthropic call goes through the adapter which attaches cache directives to each input block:

```
┌─ CACHE LAYER 1 (ephemeral_5m) — refreshed every user turn ─┐
│  • System prompt (the agent's "persona")   ~2k tokens       │
│  • Current request envelope                ~0.5k tokens     │
└─────────────────────────────────────────────────────────────┘

┌─ CACHE LAYER 2 (ephemeral_1h) — refreshed per user session ┐
│  • Shared-types for the response schema    ~3k tokens       │
│  • Error catalogue (for tool-call hints)   ~1k tokens       │
│  • User preferences summary                ~1k tokens       │
│  • Place catalogue slice (trip-relevant)   ~5k tokens       │
└─────────────────────────────────────────────────────────────┘

┌─ CACHE LAYER 3 (ephemeral_1h) — per-trip scoped ────────────┐
│  • Trip draft / itinerary summary          ~3–8k tokens     │
│  • Conversation history (last N turns)     ~2–5k tokens     │
└─────────────────────────────────────────────────────────────┘
```

**Expected hit rate.** 60–80% input-cost reduction (§22.2). Adapter emits a `ai_cache_hit_ratio` metric; alert when 14-day average drops below **60%** — means either our cache keys are too narrow or the model config is churning.

## Fallback chain (Anthropic API outage)

Playbook §22.3 says "uncached LLM costs kill the business"; Playbook §31.4 lists `runbook-ai-service-down.md`. Neither covers a pure Anthropic-side outage. The adapter implements this chain:

1. **Anthropic primary.** Normal call to `claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5`.
2. **Anthropic failover region.** Same request retried against a second region endpoint (e.g. `us-east-1` → `eu-central-1`). Circuit breaker reopens after 5 min.
3. **OpenAI equivalent** (same `TaskKind`, mapped to `gpt-4o` / `gpt-4o-mini`). Requires `OPENAI_API_KEY` set (already in env schema). Quality gap tolerated as degraded-not-broken.
4. **Self-hosted fallback** (Llama 3.1 via `ai-service`, when slot is wired). Degraded quality but never external-dep.
5. **Template fallback.** For itinerary generation specifically — cached itinerary templates per (city, vibe, days) looked up from Postgres. Ships a trip that's "generic but valid" with a UI banner "Personalisation unavailable — tap to retry."
6. **Hard fail** (LAST resort). Return `AI_SERVICE_DEGRADED` domain error to the caller. The UI surfaces "AI is currently unavailable, please retry in a few minutes" — no stack trace, no blank screen.

Levels 1–4 are all automatic behind the adapter; level 5 is explicit per-feature in the calling use-case; level 6 is the `DomainError` path that the `DomainExceptionFilter` renders.

Task-by-task fallback table:

| Runtime task         | 1 Anthropic | 2 Anthropic-failover | 3 OpenAI |      4 Self-host      | 5 Template |                  6 Hard fail                   |
| -------------------- | :---------: | :------------------: | :------: | :-------------------: | :--------: | :--------------------------------------------: |
| Itinerary generation |     ✅      |          ✅          |    ✅    | ✅ (when Llama wired) |     ✅     |                       ✅                       |
| Live re-plan         |     ✅      |          ✅          |    ✅    |          ✅           |     —      |                       ✅                       |
| Chat / edit suggest. |     ✅      |          ✅          |    ✅    |           —           |     —      |                       ✅                       |
| Agent safety check   |     ✅      |          ✅          |    ✅    |           —           |     —      | ✅ (blocks the action; does not silently pass) |
| Ambiguity resolution |     ✅      |          ✅          |    ✅    |           —           |     —      |           ✅ (ask the user directly)           |

**Safety-check note.** Step 6 for agent safety must NOT silently approve. If the whole AI stack is down, the agent-action UI disables with a "Safety check unavailable — please retry" banner. This is a hard-fail-closed rule — documented in the runbook as well.

## Consequences (binding)

- **Every Anthropic call goes through the `@app/ai` adapter.** Direct SDK calls from domain / application / infrastructure code fail review. The adapter owns the cache directives and the fallback chain.
- **`TaskKind` is the only model-selection hook.** Callers MUST NOT pass model names. Adding a new `TaskKind` is a manifest-level change and an entry in the routing table above.
- **`ai_cache_hit_ratio` is a tracked SLO.** 14-day rolling average ≥ 60%. Drops below are a P2 alert — investigate cache-key churn.
- **`AI_SERVICE_DEGRADED` is a first-class domain error.** Mapped to HTTP 503 with `Retry-After` by the filter. Clients retry with backoff.
- **Self-hosted models' inference budgets (GPU vs CPU) are documented in `ai-service`'s contract.** Any change to model / quantisation requires a contract edit.
- **The Llama 3.1 lane stays reserved but unwired** until we have (a) a labelled itinerary-generation dataset of ≥ 50k examples and (b) fine-tune + eval pipelines running in CI. Wiring it earlier is a superseding ADR.

## Re-evaluation triggers

This ADR is reviewed if any of the following becomes true:

- **Anthropic SKU changes.** New model tier (Haiku 5 / Opus 5) — update the routing table and cost-amortise the switch.
- **Cache hit ratio drops below 60%** for two consecutive 14-day windows → architectural review (cache keys? context shape? user-session TTLs?).
- **Self-hosted translation cost > $0.001/call** after infra amortisation — re-evaluate NLLB (bigger quant model, GPU bump, or external API).
- **An Anthropic outage > 1 hour exhausts our OpenAI-fallback budget** — the fallback chain's step 3 needs a cheaper alternative (OpenAI mini / Groq).
- **Itinerary-generation dataset crosses 50k labelled examples AND a fine-tune demonstrates ≥95% of Sonnet quality on a blind eval** — Llama 3.1 lane activates via a superseding ADR.
- **Safety / compliance rule changes** require fake-review classification auditability beyond what DistilBERT's logit outputs give us — consider moving to a rule-engine + ML hybrid.

## Links

- Playbook §21 (build-time token economics) · §22 (runtime LLM economics) · §23 (unit economics).
- Sibling ADRs: [ADR-005 Frontend](./ADR-005-frontend-stack.md), [ADR-006 Backend](./ADR-006-backend-stack.md), [ADR-007 Data layer](./ADR-007-data-layer.md).
- [ADR-002](./ADR-002-service-extraction-triggers.md) — why ai-service is extracted to Python.
- [`docs/services/ai-service/contract.md`](../services/ai-service/contract.md) — the sidecar's endpoints + SLOs + fallbacks.
- [`docs/architecture/context-map.md`](../architecture/context-map.md) §Translation — the consumers of `TranslationPort`.
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) · [NLLB](https://ai.meta.com/research/no-language-left-behind/) · [Whisper](https://github.com/openai/whisper) · [Llama 3.1](https://ai.meta.com/blog/meta-llama-3-1/).
