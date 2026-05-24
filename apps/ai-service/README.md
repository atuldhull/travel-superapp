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

The contract is defined in THREE places, each derived from the one above it; drift is gated by CI ([D1] sdk:check + [F3] shared-types:check):

| #   | File                                                                                                        | Form                                   | Authoring                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | [`docs/services/ai-service/contract.md`](../../docs/services/ai-service/contract.md)                        | Prose (humans)                         | Hand-written; cross-checked against #2 by `contract-drift.fitness.spec.ts`                                 |
| 2   | [`packages/shared-types/src/ai-service/*.ts`](../../packages/shared-types/src/ai-service/)                  | Zod schemas (TS source of truth)       | Hand-written; `import { TranslateRequest } from '@app/shared-types/ai-service'`                            |
| 3   | [`packages/shared-types/schemas/ai-service/*.schema.json`](../../packages/shared-types/schemas/ai-service/) | JSON Schema (language-neutral handoff) | **Generated** by `pnpm --filter=@app/shared-types schemas:emit`; gated by `pnpm shared-types:check` ([F3]) |

### Python side (when [IV.18.2.11] ships)

The Python service consumes the JSON Schemas in #3 directly — it never sees the TS / Zod. Pydantic models are minted with zero hand-written code:

```bash
pip install datamodel-code-generator
datamodel-codegen \
  --input ../../packages/shared-types/schemas/ai-service \
  --input-file-type jsonschema \
  --output ai_service/schemas
```

That command is what closes the "single contract, both sides" loop the road-to-10 review called out. Run it in CI after `pip install`; commit the generated pydantic files into `apps/ai-service/ai_service/schemas/`; treat them like the SDK's `packages/sdk/src/generated/` — codegen output, prettier-ignored, drift-gated.

## Placeholder

Real Python code lands in **[IV.18.2.11]**. Until then, this folder holds only the contract pointer above; the TS Zod sources + emitted JSON Schemas are already concrete from the Node side today, so the Python build just runs the `datamodel-codegen` command above to bootstrap its own typed boundary — no hand-translation step.
