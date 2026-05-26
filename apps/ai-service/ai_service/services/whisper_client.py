"""
faster-whisper STT adapter (optional dependency).

`faster-whisper` is heavy: the base model is ~150MB, medium is ~1.5GB. We
keep it as an OPTIONAL extras group so the default $0 Docker image stays
small:

    pip install '.[stt]'

When the extras aren't installed, this module reports `enabled=False` and
the FastAPI handler returns an echo-stub `STTPartial`. When installed, the
first call lazy-loads the model into VRAM/RAM (~5-30s); subsequent calls
are warm.

Concurrency model:

- faster-whisper exposes a synchronous `transcribe()` that yields segment
  objects. We call it via `asyncio.to_thread` so the FastAPI event loop
  stays free.
- The model is loaded once at first-use, then cached on the instance.
- Audio comes in as bytes (raw PCM or compressed). For the v1 stub-to-real
  step we assume PCM 16-bit mono at the declared sampleRateHz; richer
  decoding (mp3/wav/webm) is a follow-up.

Installed by [S-A3] of the S-series real-functionality closeout.
"""

from __future__ import annotations

import asyncio
import logging
import os
import struct
from typing import Any

logger = logging.getLogger("ai-service.whisper")

try:
    from faster_whisper import WhisperModel  # type: ignore[import-not-found]

    _WHISPER_IMPORTED = True
except ImportError:  # pragma: no cover — exercised in CI without extras
    WhisperModel = None  # type: ignore[assignment,misc]
    _WHISPER_IMPORTED = False

_DEFAULT_MODEL = os.environ.get("WHISPER_MODEL", "base.en")
_DEFAULT_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")


class WhisperClient:
    """Lazy-load faster-whisper. Best-effort; never raises on transcribe failure."""

    def __init__(
        self,
        model_name: str = _DEFAULT_MODEL,
        compute_type: str = _DEFAULT_COMPUTE_TYPE,
    ) -> None:
        self.model_name = model_name
        self.compute_type = compute_type
        self._model: Any = None
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return _WHISPER_IMPORTED

    @property
    def model_version(self) -> str:
        return f"faster-whisper:{self.model_name}"

    async def transcribe(
        self, audio_bytes: bytes, sample_rate_hz: int
    ) -> tuple[str, float] | None:
        """
        Transcribe a chunk of PCM-16 mono audio at `sample_rate_hz`.
        Returns `(text, confidence)` on success, None on miss.
        """
        if not self.enabled or not audio_bytes:
            return None
        try:
            await self._ensure_model()
            if self._model is None:
                return None
            samples = _pcm16_to_float32(audio_bytes)
            return await asyncio.to_thread(self._transcribe_sync, samples, sample_rate_hz)
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.warning("whisper transcribe failed: %s", exc)
            return None

    async def _ensure_model(self) -> None:
        if self._model is not None:
            return
        async with self._lock:
            if self._model is not None:
                return
            self._model = await asyncio.to_thread(
                WhisperModel, self.model_name, compute_type=self.compute_type
            )
            logger.info(
                "whisper model loaded: name=%s compute_type=%s",
                self.model_name,
                self.compute_type,
            )

    def _transcribe_sync(self, samples: list[float], sample_rate_hz: int) -> tuple[str, float]:
        # faster-whisper expects float32 numpy or sequence + the sample rate.
        # We pass a list[float]; the library accepts any sequence-like input
        # and converts internally. avg_logprob is mapped to a [0,1] confidence
        # via a sigmoid-ish saturating function.
        segments, info = self._model.transcribe(  # type: ignore[union-attr]
            samples,
            language=None,
            task="transcribe",
            beam_size=1,
            vad_filter=False,
            sample_rate=sample_rate_hz,
        )
        _ = info  # discard — we don't yet surface language detection upstream
        texts: list[str] = []
        logprobs: list[float] = []
        for seg in segments:
            texts.append(seg.text)
            if seg.avg_logprob is not None:
                logprobs.append(seg.avg_logprob)
        text = "".join(texts).strip()
        # avg_logprob is in (-inf, 0]; map to [0, 1] with a smooth squash.
        confidence = 0.0
        if logprobs:
            mean = sum(logprobs) / len(logprobs)
            # exp(mean) gives a probability in (0, 1]; clamp.
            from math import exp

            confidence = max(0.0, min(1.0, exp(mean)))
        return text, confidence


def _pcm16_to_float32(audio: bytes) -> list[float]:
    """Convert little-endian 16-bit signed PCM to normalized float32 in [-1, 1]."""
    if len(audio) % 2 != 0:
        # Drop the last odd byte rather than blow up — partial chunks happen
        # on streaming boundaries.
        audio = audio[:-1]
    n = len(audio) // 2
    if n == 0:
        return []
    raw = struct.unpack(f"<{n}h", audio)
    inv = 1.0 / 32768.0
    return [s * inv for s in raw]
