# POST‑2.0 Pre‑Flight Report

> Written autonomously on **2026‑05‑16** while you were away. No code was
> written, nothing was committed, nothing was authorized on your behalf. This
> documents verification + hardening of the 2.0 planning artifacts only.

---

## What I did while you were out

You asked me to "continue the work." The 2.0 _build_ is deliberately blocked
without you (it needs your D1–D8 decisions and commit authorization — by
design, see below). So I did the highest‑value work that needs **no
authorization, no code, no commits**: I deep‑verified every codebase claim the
prompt book makes, then hardened it.

**Three artifacts now exist (all uncommitted, all reversible):**

| File                                              | What it is                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`docs/APP_VISION_2.0.html`](APP_VISION_2.0.html) | The 2.0 strategy (§1–§24). Same visual system as your 1.0 vision doc.                                           |
| [`docs/POST_2.0_PROMPTS.md`](POST_2.0_PROMPTS.md) | The drop‑in execution prompt book — 1 setup + 11 feature prompts, your exact 1.0 format. **Now deep‑verified.** |
| `docs/POST_2.0_PREFLIGHT.md`                      | This file.                                                                                                      |

A sub‑agent read the real source for **12 grounding areas**. Findings are now
baked into a "Verified codebase facts" block at the top of the prompt book —
that block is declared ground truth (if a prompt disagrees with it, the block
wins).

---

## The one bug I caught (this matters)

**The prompt book originally specified `vector(768)` for trip embeddings. The
installed pgvector dimension in this codebase is `vector(1024)`** (model
`PlaceEmbedding`, migration `20260420081604_vector_ivfflat`,
`ivfflat vector_l2_ops lists=100`).

A 768‑dim column + a 768‑dim model against a 1024‑convention codebase would
have failed at migration/index/query time — exactly the silent drift LAW 3
exists to prevent. **Corrected everywhere** in both docs:

- Embedding column → `vector(1024)`, `vector_l2_ops` ivfflat `lists=100`
  (copies the `PlaceEmbedding` precedent exactly).
- Embedding model → **Ollama `mxbai-embed-large`** (emits exactly 1024, free,
  local) instead of `nomic-embed-text` (768).

---

## Other corrections applied (precision, not bugs)

| Area                      | Was                                      | Now (verified)                                                                                                                                                                        |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedding runtime         | "Python `ai-service`"                    | **Local Ollama via native fetch.** `apps/ai-service` is a README only — no Python service exists. Do not stand one up.                                                                |
| Scheduler                 | "reuse existing scheduler infra" (vague) | No `@nestjs/schedule`. Hand‑rolled `setInterval` + `OnModuleInit/OnModuleDestroy` + re‑entrant guard + skip in `NODE_ENV==='test'`. Copy `account-purge.scheduler.ts`.                |
| Concurrency lock          | "Redis per‑watch lock"                   | No shared Redis service exists. Construct own `ioredis` via `ConfigService.REDIS_URL`; `SET … EX … NX`. Pattern: `redis-throttler.storage.ts`.                                        |
| Weather signal            | new Open‑Meteo HTTP adapter              | **Reuse the existing `WEATHER_PROVIDER` port** (`OpenMeteoWeatherProvider` + cache decorator already exist). Don't re‑implement.                                                      |
| Grounding (POST.2C.3)     | scope omitted the planner change         | `TripPlannerRequest` has **no** grounding field. Added scope: an **additive optional** `groundingContext?` on the port + fold into Gemini/Ollama adapters (Anthropic/stub untouched). |
| Notifications (POST.2A.4) | "add one event type, no other change"    | Real shape: a new handler + reuse the existing `'trip'` category via the prefix→category helper. No edit to `NOTIFICATION_CATEGORIES`.                                                |
| Social block (POST.2B.1)  | "enforced in the DOMAIN layer"           | Reaction gates live in the **application** layer today (`CastVoteUseCase`/`CreateReviewUseCase`/`trip-heart-counter`). Block guard goes there, alongside them.                        |
| Memory Books (POST.2C.1)  | "media create path" (vague)              | Exact: `CreateMemoryBookUseCase.execute(cmd)`. A `publish-memory-book.use-case.ts` exists — the draft path must **not** call it.                                                      |
| Feature flag (POST.2A.1)  | "optional boolean default false"         | Exact: add `FEATURE_AGENT_ENABLED: z.coerce.boolean().default(false),` to `FeaturesSchema`.                                                                                           |
| Visibility enum           | unknown                                  | Verified **absent** — POST.2B.2 may add it, no clash.                                                                                                                                 |

---

## Why I did not start building (this is correct, not a stall)

Three hard blocks, all by design — and one is _your own_ instruction encoded in
the prompts:

1. **Phase 0 (`POST.2.0.0`) requires you to lock decisions D1–D8.** The prompt
   literally says "if any decision is unset, STOP and ask — do not guess."
   Each decision changes the code that gets written. Guessing them would
   corrupt the serious effort you asked for.
2. **`CLAUDE.md` forbids surprise commits and auto‑advance.** Executing a
   feature prompt means committing code you can't review.
3. Writing irreversible code/migrations unattended, with no ability for you to
   authorize, is the textbook case for _confirm first_ — on the project you
   said is the biggest of your career, that bar should be higher, not lower.

---

## Your resume point (do these, in this order)

1. **Read** `docs/APP_VISION_2.0.html` §22 (the 8 decisions) and §24 (the run
   sheet). My recommendation is bolded on each decision.
2. **Lock D1–D8.** Tell me your picks (or "go with your recommendations").
3. Then I run **`POST.2.0.0`** — the clean‑baseline commit (this is when the
   uncommitted pile, incl. these docs, gets its one `chore:` commit).
4. Then, one prompt per session, with a hard stop at each Phase gate:
   `2A.1·2A.2 → 2A.3 → 2A.4 → 2A.5 → [GATE] → 2B.1·2B.2 → 2B.3 → [GATE] →
2C.1 → 2C.2·2C.3 → [GATE]`.

Nothing is broken. Nothing is mid‑flight. The plan is now grounded in verified
source, not assumptions. When you're back: pick the decisions and say go.

---

_Provenance: autonomous verification + hardening pass, 2026‑05‑16. Sub‑agent
read source for 12 grounding areas; corrections applied to
`APP_VISION_2.0.html` + `POST_2.0_PROMPTS.md`. No code, no commits, no external
calls._
