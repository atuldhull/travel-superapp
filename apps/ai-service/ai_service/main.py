"""
ai-service — FastAPI entrypoint.

Installed by [R6] of the road-to-10-partials closeout. Today every
inference endpoint returns a STUB response (static fallback) so the
service is fully deployable + the contract is exercisable end-to-end
without any model weights or paid SaaS. Real inference logic lands
in prompt [IV.18.2.11].

What ships today:

- /health/live   — Kubernetes-style liveness probe (always 200)
- /health/ready  — readiness probe (200 once the app has booted)
- /v1/translate  — accepts the TranslateRequest schema; returns a
                   pass-through stub (the input text unchanged).
                   When real NLLB-200 lands, only this handler changes.
- /v1/embeddings — accepts the EmbeddingsRequest schema; returns a
                   deterministic-but-fake 1024-dim vector. Same
                   contract; real sentence-transformers later.

What does NOT ship today (deferred to [IV.18.2.11]):

- Real translation / STT / embeddings / fake-review / crowd models
- Ray Serve deployment topology
- Model warmup + GPU batching (see docs/architecture/ai-inference-scale.md
  [Q10] for the plan)

Run locally:

    uvicorn ai_service.main:app --host 0.0.0.0 --port 8001

Run in prod via the Dockerfile (uvicorn under tini, see Dockerfile CMD).
"""

from __future__ import annotations

import hashlib
import os

from fastapi import FastAPI
from pydantic import BaseModel

from ai_service.schemas import (
    AiServiceHealthResponse,
    EmbeddingsRequest,
    EmbeddingsResponse,
    TranslateRequest,
    TranslateResponse,
)
from ai_service.schemas.health import AiServiceHealthResponseRay
from ai_service.services.argos_translator import ArgosTranslator
from ai_service.services.ollama_client import OllamaClient
import time

# Module-level singletons — these carry instance state (installed-pair set,
# event-loop lock) but no module-level mutable globals. Re-instantiating
# per-request would lose the install cache and re-read env on every call.
_ollama = OllamaClient()
_argos = ArgosTranslator()


app = FastAPI(
    title="TravelSuperApp ai-service",
    description="Python ML sidecar — stub-only today; real inference lands in [IV.18.2.11].",
    version="0.1.0",
)


# ───────────────────────────────────────────────────────────────────
# Health probes — mirror apps/api's /health/{live,ready} shape so a
# single liveness contract works across the whole stack.
# ───────────────────────────────────────────────────────────────────


class LiveResponse(BaseModel):
    status: str = "ok"


@app.get("/health/live", response_model=LiveResponse, tags=["health"])
def health_live() -> LiveResponse:
    """Liveness probe — true as long as the process is running."""
    return LiveResponse()


@app.get("/health/ready", response_model=AiServiceHealthResponse, tags=["health"])
def health_ready() -> AiServiceHealthResponse:
    """
    Readiness probe — true once FastAPI is booted. Future versions
    will also gate on "models loaded" + Ray replicas healthy before
    returning ok; today the stub responds the moment the process
    binds the port (ray replicas reported as 0/0 — no Ray runtime yet).
    """
    return AiServiceHealthResponse(
        status="ok",
        ray=AiServiceHealthResponseRay(replicas=0, healthy=0),
    )


# ───────────────────────────────────────────────────────────────────
# Translation — stub
# ───────────────────────────────────────────────────────────────────


@app.post("/v1/translate", response_model=TranslateResponse, tags=["inference"])
async def translate(req: TranslateRequest) -> TranslateResponse:
    """
    Real translation via Argos when the optional `[translate]` extras are
    installed; echo stub fallback when they are not (or when the requested
    language pair has no Argos package).

    Deploy posture: the default Dockerfile does NOT install Argos to keep
    image size small. Operators opt-in with `pip install '.[translate]'`
    in their build pipeline when they want real translation. The wire
    contract is unchanged either way — callers detect the upgrade via
    the `modelVersion` field (`stub@0.1.0` → `argos@1.9.6`).

    Installed by [S-A2] of the S-series real-functionality closeout.
    """
    start_ns = time.monotonic_ns()
    translated = await _argos.translate(req.text, req.sourceLang, req.targetLang)
    elapsed_ms = max(0, (time.monotonic_ns() - start_ns) // 1_000_000)

    if translated is None:
        # Argos unavailable, language pair missing, or translation errored.
        # Fall back to echo so the caller's flow doesn't break.
        return TranslateResponse(
            text=req.text,
            modelVersion="stub@0.1.0",
            cacheHit=False,
            latencyMs=int(elapsed_ms),
        )

    return TranslateResponse(
        text=translated,
        modelVersion=_argos.model_version,
        cacheHit=False,
        latencyMs=int(elapsed_ms),
    )


# ───────────────────────────────────────────────────────────────────
# Embeddings — stub
# ───────────────────────────────────────────────────────────────────


def _stub_embedding(text: str) -> list[float]:
    """
    Deterministic-but-fake 1024-dim vector. Hashes the input + spreads
    bytes into 1024 floats in [-1, 1]. Same text → same vector → caller's
    cache works; not semantically meaningful.
    """
    h = hashlib.sha512(text.encode("utf-8")).digest()
    # 64 bytes from sha512; repeat to fill 1024 dims.
    vec = []
    for i in range(1024):
        b = h[i % len(h)]
        vec.append((b - 127.5) / 127.5)
    return vec


@app.post("/v1/embeddings", response_model=EmbeddingsResponse, tags=["inference"])
async def embeddings(req: EmbeddingsRequest) -> EmbeddingsResponse:
    """
    Real embeddings via Ollama when `OLLAMA_URL` is set; deterministic-but-fake
    fallback otherwise. The wire shape (1024 floats) matches
    `PlaceEmbedding.embedding vector(1024)` in the Prisma schema either way.

    Per-text fallback: if Ollama answers some texts and fails others, each
    miss is stubbed independently. The response `model` reports the dominant
    source ("mxbai-embed-large@1.0" if any real vector came back, else
    "stub-deterministic@0.1.0") — observability picks up partial degradation
    via the per-call WARN logs in OllamaClient.

    Installed by [S-A1] of the S-series real-functionality closeout.
    """
    vectors = await _ollama.embed_batch(list(req.inputs))
    any_real = any(v is not None for v in vectors)

    # Stub-fill the misses so the response shape is always valid.
    filled = [
        v if v is not None and len(v) == 1024 else _stub_embedding(text)
        for v, text in zip(vectors, req.inputs)
    ]

    return EmbeddingsResponse(
        embeddings=filled,
        model=f"{_ollama.model}@1.0" if any_real else "stub-deterministic@0.1.0",
        dimensions=1024,
    )


# Local dev entrypoint — `python -m ai_service.main` for quick tests.
if __name__ == "__main__":
    import uvicorn  # noqa: PLC0415  -- intentionally late, dev-only

    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)  # noqa: S104  -- bind-all is intended for the container
