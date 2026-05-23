# ai-service

Python 3.12 + FastAPI + Ray Serve sidecar. Hosts the ML stack:

- **NLLB-200** — 200-language translation.
- **Whisper** — voice-to-text.
- **DistilBERT** — fake-review classification.
- **Crowd prediction** — Prophet / LightGBM on satellite + popular-times data.
- **Embeddings** — sentence-transformers for RAG.

## Not in the pnpm workspace

This app is explicitly excluded from `pnpm-workspace.yaml` (`!apps/ai-service`). Python tooling (pyproject.toml, uv / poetry, tests, Docker) is scaffolded in prompt **[IV.18.2.11]**.

## Contract

The contract is defined in TWO places that must stay in sync:

- **Prose form:** [`docs/services/ai-service/contract.md`](../../docs/services/ai-service/contract.md) — transport (gRPC + REST), endpoints, SLOs, failure / circuit-breaker policy, runbook pointer.
- **Code form (single source of truth):** [`packages/shared-types/src/ai-service/`](../../packages/shared-types/src/ai-service/) — Zod schemas + inferred TS types. Import via `@app/shared-types/ai-service`. The Python service will mirror these as pydantic models via codegen in **[IV.18.2.11]**.

When this service is built, generate the pydantic models from the Zod schemas; do not hand-write a Python copy. Drift between doc / TS / pydantic is the failure mode this layout is designed to prevent.

## Placeholder

Real Python code lands in **[IV.18.2.11]**. Until then, this folder holds only the contract pointer above; the schemas are already authored in `@app/shared-types` so the boundary is concrete from the TS side today.
