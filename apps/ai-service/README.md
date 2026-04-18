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

See `docs/services/ai-service/contract.md` once prompt `[II.7.3]` creates it.

## Placeholder

Real code lands in **[IV.18.2.11]**. Until then, this folder is intentionally empty.
