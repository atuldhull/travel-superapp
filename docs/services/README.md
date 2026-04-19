# Extracted Services

> The four out-of-process services named in Playbook §7.3 that live alongside `apps/api`. Everything else is a NestJS module inside the modular monolith (see [ADR-001](../adr/ADR-001-modular-monolith.md)).
>
> Each service owns a `contract.md` covering **transport · endpoints/topics · SLO · failure/degradation**. Published by `[II.7.3]`.

| Service               | Stack                                 | Role                                                                         | Contract                                                             |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ai-service`          | Python 3.12 · FastAPI · Ray Serve     | NLLB translation · Whisper STT · fake-review · crowd prediction · embeddings | [ai-service/contract.md](./ai-service/contract.md)                   |
| `media-service`       | Node 22 · Sharp · ffmpeg              | Image/video pipeline · 3D tile caching                                       | [media-service/contract.md](./media-service/contract.md)             |
| `notification-worker` | NestJS standalone · BullMQ            | Event-driven push / email / SMS fan-out with quiet-hours                     | [notification-worker/contract.md](./notification-worker/contract.md) |
| `crawler-worker`      | NestJS standalone · Playwright · cron | Scheduled price / events / OSM scraping                                      | [crawler-worker/contract.md](./crawler-worker/contract.md)           |

Any contract change — new endpoint, new topic, SLO tightened or loosened — is a PR that edits the contract doc AND the matching `@app/shared-types` schemas, in the same commit.

## Links

- [ADR-001](../adr/ADR-001-modular-monolith.md) · [ADR-002](../adr/ADR-002-service-extraction-triggers.md) · [ADR-003](../adr/ADR-003-event-backbone.md).
- [context-map](../architecture/context-map.md) — maps each bounded context to the service(s) it consumes.
- [packages/manifest.md](../packages/manifest.md) — which TS `@app/*` packages each consumer surface may import.
