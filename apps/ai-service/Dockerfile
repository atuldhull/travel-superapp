# syntax=docker/dockerfile:1.7
#
# Production Dockerfile for apps/ai-service.
#
# Python 3.12-slim → install deps via pyproject.toml → run uvicorn under tini.
# Stub-only today (no model weights baked in); when real models land in
# [IV.18.2.11], either:
#   (a) bake the weights into a FAT image (CPU-only path), OR
#   (b) mount them from a volume / fetch from HuggingFace at boot.
# Either path keeps this 3-stage shape; the runner stage just gets bigger.
#
# Build (from repo root, not apps/ai-service — we need the bilingual
# contract's Pydantic emit step to be reproducible):
#   docker build -f apps/ai-service/Dockerfile -t travel-ai-service:latest .
#
# Installed by [R6] of the road-to-10-partials closeout.

# ─── Stage 1: deps + venv ───────────────────────────────────────
FROM python:3.12-slim-bookworm AS deps

WORKDIR /workspace

# Build deps (psutil, cryptography wheels, etc.). Keep this stage's
# image small by removing apt cache.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY pyproject so dep changes invalidate the cache when needed.
COPY apps/ai-service/pyproject.toml ./

# Build a venv at /opt/venv and install deps there.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

# ─── Stage 2: builder (copies source) ────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /workspace
COPY --from=deps /opt/venv /opt/venv
COPY apps/ai-service ./apps/ai-service

# Compile pyc up front so cold-boot doesn't pay the cost.
ENV PATH="/opt/venv/bin:$PATH"
RUN python -m compileall -q ./apps/ai-service/ai_service

# ─── Stage 3: runner (distroless-equivalent slim) ────────────────
FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

# Bring just the venv + source.
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /workspace/apps/ai-service ./

# tini for proper signal handling (SIGTERM → uvicorn graceful shutdown).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 65532 --shell /bin/false aiservice

USER aiservice

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

EXPOSE 8001

# tini → uvicorn. `--proxy-headers` so Fly's edge X-Forwarded-* land
# in the request scope properly. `--no-access-log` because OTLP
# instrumentation captures requests; the uvicorn access log would be
# duplicate noise.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "ai_service.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--proxy-headers", \
     "--no-access-log"]
