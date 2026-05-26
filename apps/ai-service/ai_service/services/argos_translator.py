"""
Argos-Translate adapter (optional dependency).

`argostranslate` is heavy: each language pair is a ~500MB model that downloads
on first use. We don't want it as a hard requirement (the Docker image stays
small for $0 deploys); we install it as an OPTIONAL extras group:

    pip install '.[translate]'

When the extras aren't installed, this module gracefully reports `enabled=False`
and the FastAPI handler falls back to the echo stub. When they ARE installed,
the first call to a new (src, tgt) pair triggers a one-time model download +
install (~30-120s depending on bandwidth); subsequent calls are warm.

Concurrency model:

- argostranslate's API is synchronous + CPU-bound. We call it via
  `asyncio.to_thread` so the FastAPI event loop stays free.
- An asyncio.Lock serialises the package-install path so two concurrent
  first-uses of the same pair don't race on disk writes.
- A simple in-memory set tracks already-installed pairs to skip the index
  scan on subsequent calls.

Installed by [S-A2] of the S-series real-functionality closeout.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("ai-service.argos")

# Try to import argostranslate at module load. If it's missing, `enabled`
# returns False and the handler stubs — same pattern as OllamaClient.
try:
    import argostranslate.package as _argos_pkg
    import argostranslate.translate as _argos_tr

    _ARGOS_IMPORTED = True
    _ARGOS_VERSION = getattr(
        __import__("argostranslate"), "__version__", "unknown"
    )
except ImportError:  # pragma: no cover — install-time miss, exercised in CI without extras
    _argos_pkg = None  # type: ignore[assignment]
    _argos_tr = None  # type: ignore[assignment]
    _ARGOS_IMPORTED = False
    _ARGOS_VERSION = "absent"


class ArgosTranslator:
    """Lazy-install Argos translator. Best-effort; never raises."""

    def __init__(self) -> None:
        # Track which (src, tgt) pairs we've installed in this process.
        # Instance state, not module — Q8-style gates don't apply here.
        self._installed: set[tuple[str, str]] = set()
        self._index_refreshed = False
        self._lock = asyncio.Lock()

    @property
    def enabled(self) -> bool:
        return _ARGOS_IMPORTED

    @property
    def model_version(self) -> str:
        return f"argos@{_ARGOS_VERSION}"

    async def translate(self, text: str, src: str, tgt: str) -> str | None:
        """
        Translate `text` from `src` to `tgt` (BCP-47 short codes — "en", "fr").
        Returns the translated string on success, None on any failure.
        If src == tgt, returns the input unchanged.
        """
        if src == tgt:
            return text
        if not self.enabled:
            return None
        try:
            await self._ensure_pair_installed(src, tgt)
            if (src, tgt) not in self._installed:
                return None
            return await asyncio.to_thread(_argos_tr.translate, text, src, tgt)
        except Exception as exc:  # noqa: BLE001 — best-effort
            logger.warning("argos translate failed (%s→%s): %s", src, tgt, exc)
            return None

    async def _ensure_pair_installed(self, src: str, tgt: str) -> None:
        """Idempotent — installs the (src, tgt) package on first call only."""
        if (src, tgt) in self._installed:
            return
        async with self._lock:
            # Double-check after acquiring lock — another coroutine may have
            # just finished the install while we were waiting.
            if (src, tgt) in self._installed:
                return
            if not self._index_refreshed:
                await asyncio.to_thread(_argos_pkg.update_package_index)
                self._index_refreshed = True
            available = await asyncio.to_thread(_argos_pkg.get_available_packages)
            pkg: Any = next(
                (p for p in available if p.from_code == src and p.to_code == tgt),
                None,
            )
            if pkg is None:
                logger.warning("argos has no package for %s→%s", src, tgt)
                return
            try:
                path = await asyncio.to_thread(pkg.download)
                await asyncio.to_thread(_argos_pkg.install_from_path, path)
            except Exception as exc:  # noqa: BLE001
                logger.warning("argos install %s→%s failed: %s", src, tgt, exc)
                return
            self._installed.add((src, tgt))
            logger.info("argos installed package %s→%s", src, tgt)
