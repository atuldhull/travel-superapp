# ai-service

Python 3.12 + FastAPI + Ray Serve sidecar. Hosts the ML stack:

- **NLLB-200** — 200-language translation.
- **Whisper** — voice-to-text.
- **DistilBERT** — fake-review classification.
- **Crowd prediction** — Prophet / LightGBM on satellite + popular-times data.
- **Embeddings** — sentence-transformers for RAG.

## Not in the pnpm workspace

This app is explicitly excluded from `pnpm-workspace.yaml` (`!apps/ai-service`). Python tooling (pyproject.toml, uv / poetry, tests, Docker) is scaffolded in prompt **[IV.18.2.11]**.

## Contract — bilingual handoff

The contract lives in FOUR places, each derived from the one above it; drift is gated by CI ([D1] sdk:check + [F3]/[G2] shared-types:check):

| #   | File                                                                                                        | Form                                        | Authoring                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | [`docs/services/ai-service/contract.md`](../../docs/services/ai-service/contract.md)                        | Prose (humans)                              | Hand-written; cross-checked against #2 by `contract-drift.fitness.spec.ts`                                  |
| 2   | [`packages/shared-types/src/ai-service/*.ts`](../../packages/shared-types/src/ai-service/)                  | Zod schemas (TS source of truth)            | Hand-written; `import { TranslateRequest } from '@app/shared-types/ai-service'`                             |
| 3   | [`packages/shared-types/schemas/ai-service/*.schema.json`](../../packages/shared-types/schemas/ai-service/) | JSON Schema (language-neutral handoff)      | **Generated** by `pnpm --filter=@app/shared-types schemas:emit`; gated by `pnpm shared-types:check` ([F3])  |
| 4   | [`ai_service/schemas/*.py`](./ai_service/schemas/)                                                          | Pydantic v2 models (Python source of truth) | **Generated** by `pnpm --filter=@app/shared-types pydantic:emit`; gated by `pnpm shared-types:check` ([G2]) |

### Python side

`ai_service/schemas/__init__.py` re-exports every model — import is one line:

```python
from ai_service.schemas import TranslateRequest, TranslateResponse, FakeReviewLabel
```

The pydantic files are emitted by a Node script (`packages/shared-types/scripts/emit-pydantic.mjs`) that walks the JSON Schemas in #3 and assembles `BaseModel` subclasses. Python isn't a host dependency on this repo — a tooled checkout regenerates and gates without ever running Python. Field names stay in `camelCase` to match the wire format 1:1; constraint metadata maps through (`min_length`, `ge`, `Literal`, `Enum`, etc.).

### Alternative (the `datamodel-code-generator` route)

The JSON Schemas in #3 are also compatible with [datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator), if the Python build ever wants to swap the emitter:

```bash
pip install datamodel-code-generator
datamodel-codegen \
  --input ../../packages/shared-types/schemas/ai-service \
  --input-file-type jsonschema \
  --output ai_service/schemas
```

Either path closes the "single contract, both sides" loop the road-to-10 review called out — the in-repo Node emitter wins on $0 + no-Python-runtime cost.

## Placeholder

Real Python application code (FastAPI routers, Ray Serve deployments, model wrappers) lands in **[IV.18.2.11]**. The pydantic boundary is concrete today; the executable service that uses it is not.
