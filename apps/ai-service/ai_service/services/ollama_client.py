"""
Async Ollama HTTP client.

Talks to a local-or-self-hosted Ollama server (default `http://localhost:11434`).
Used by /v1/embeddings to produce real 1024-dim vectors from `mxbai-embed-large`
(or whatever `EMBEDDING_MODEL` env points at).

Design notes:

- Best-effort: every public method returns the result OR `None`. Never raises
  upward on transport failures — the FastAPI handler decides whether to fall
  back to the deterministic-fake stub. That mirrors the Node side's
  OllamaEmbeddingAdapter pattern (apps/api/src/modules/feed/infrastructure/
  ollama-embedding.adapter.ts) so behaviour is symmetric across services.

- Per-call timeout via httpx (default 30s). The first call after model swap
  is slow (Ollama lazy-loads weights into VRAM); subsequent calls are warm.

- The endpoint is `POST /api/embeddings` with `{ model, prompt }` returning
  `{ embedding: list[float] }`. Ollama takes ONE prompt per call — for a batch
  of N inputs we fire N requests in parallel via asyncio.gather.

- No circuit-breaker library on the Python side yet (no @app/resilience for
  Python). The best-effort-with-fallback pattern is the breaker: a single
  failure degrades cleanly to stub for that text, the whole batch never 500s.

Installed by [S-A1] of the S-series real-functionality closeout.
"""

from __future__ import annotations

import asyncio
import logging
import os

import httpx

logger = logging.getLogger("ai-service.ollama")


class OllamaClient:
    """Minimal async client for Ollama's HTTP API."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout_s: float = 30.0,
    ) -> None:
        # Trim trailing slashes so callers can pass either form.
        self.base_url = (base_url or os.environ.get("OLLAMA_URL", "")).rstrip("/")
        self.model = model or os.environ.get("EMBEDDING_MODEL", "mxbai-embed-large")
        self.timeout_s = timeout_s

    @property
    def enabled(self) -> bool:
        """True iff OLLAMA_URL is configured. Otherwise the handler stubs."""
        return bool(self.base_url)

    async def embed_one(self, text: str, client: httpx.AsyncClient) -> list[float] | None:
        """
        Request a single embedding. Returns the vector on success, None on any
        failure (network, non-200, malformed body). Never raises.
        """
        if not self.enabled:
            return None
        try:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=self.timeout_s,
            )
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            logger.warning("ollama embed transport error: %s", exc)
            return None
        if response.status_code != 200:
            logger.warning(
                "ollama embed non-200: status=%s body=%s",
                response.status_code,
                response.text[:200],
            )
            return None
        try:
            payload = response.json()
        except ValueError:
            logger.warning("ollama embed body not JSON: %s", response.text[:200])
            return None
        vector = payload.get("embedding")
        if not isinstance(vector, list) or not vector or not all(
            isinstance(x, (int, float)) for x in vector
        ):
            logger.warning("ollama embed body missing/invalid 'embedding' field")
            return None
        return [float(x) for x in vector]

    async def embed_batch(self, texts: list[str]) -> list[list[float] | None]:
        """
        Request N embeddings in parallel. Returns a list of len(texts) where
        each slot is either a vector or None (so the caller can stub each
        miss independently — partial success is fine).
        """
        if not self.enabled or not texts:
            return [None] * len(texts)
        async with httpx.AsyncClient() as client:
            return await asyncio.gather(*(self.embed_one(t, client) for t in texts))
