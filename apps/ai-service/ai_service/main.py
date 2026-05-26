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
def translate(req: TranslateRequest) -> TranslateResponse:
    """
    Translation stub — echoes the input text back. The CONTRACT
    (`TranslateRequest` / `TranslateResponse` shape) is real; the
    inference is not.

    When NLLB-200 lands, only this function changes. Callers using
    `@app/shared-types`'s `TranslateRequest` Zod schema don't need
    to touch a line. The `modelVersion` field lets the caller detect
    the swap from `stub@0.1.0` → `nllb-200@1.0` without code changes.
    """
    return TranslateResponse(
        text=req.text,
        modelVersion="stub@0.1.0",
        cacheHit=False,
        latencyMs=0,
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
def embeddings(req: EmbeddingsRequest) -> EmbeddingsResponse:
    """
    Embeddings stub — deterministic-but-fake vectors. Real
    sentence-transformers lands in [IV.18.2.11]. The wire shape
    (1024 floats) matches `PlaceEmbedding.embedding vector(1024)`
    in the Prisma schema so end-to-end integration works today.
    """
    return EmbeddingsResponse(
        embeddings=[_stub_embedding(text) for text in req.inputs],
        model="stub-deterministic@0.1.0",
        dimensions=1024,
    )


# Local dev entrypoint — `python -m ai_service.main` for quick tests.
if __name__ == "__main__":
    import uvicorn  # noqa: PLC0415  -- intentionally late, dev-only

    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)  # noqa: S104  -- bind-all is intended for the container
