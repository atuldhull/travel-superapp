# Use-case pattern

> The canonical shape every application-layer operation in `apps/api` follows. If a PR adds an `*.use-case.ts` file that diverges from this contract, the PR fails review. One pattern, enforced, across all 17 bounded contexts.
>
> Installed by prompt `[III.11.2]`. Source: Playbook [§11.2](../../travel-app-playbook.md).

---

## Contract

Every use-case MUST obey these five rules. They are intentionally tight — the cost of divergence across 17 modules is a maintainability tax we refuse to pay.

1. **One public method: `execute(cmd)`.** No overloads, no static helpers calling back into the instance. A reader opening any `*.use-case.ts` file knows exactly where the business logic starts.
2. **Commands are plain DTOs, validated with Zod before `execute` runs.** Validation happens at the interface layer (`ZodValidationPipe` or equivalent). By the time `execute` has the command object, its shape is guaranteed. `execute` does not re-validate input structure.
3. **Returns a DTO, never an entity.** Domain entities (`Trip`, `Place`, `User`) never cross the use-case boundary outbound. Mappers (`TripMapper.toDto(trip)`) convert on the way out. Prevents the classic "ORM entity leaked to the HTTP layer" trap.
4. **Publishes domain events to `EventBus` AFTER successful persistence.** Order matters: `repo.save(x)` first, then `events.publish(...)`. A crash between the two is recoverable via the transactional outbox ([ADR-003 §binding rules](../adr/ADR-003-event-backbone.md)) for payment-class flows; for everything else, at-least-once is the contract.
5. **No `try/catch` around expected domain errors.** A `ValidationError`, `NotFoundError`, `InvariantError` thrown inside `execute` bubbles untouched to the global `DomainExceptionFilter`. Catch only to add context (re-throw) or for a genuine recovery path that the domain model supports.

These rules compose — a use-case that violates #3 but follows #1–#2 is still broken. All five together or none.

---

## Canonical example (verbatim from Playbook §11.2)

```ts
// modules/trip/application/generate-itinerary.use-case.ts
@Injectable()
export class GenerateItineraryUseCase {
  constructor(
    @Inject(PLACES_PORT) private readonly places: PlacesPort,
    @Inject(AI_PORT) private readonly ai: AiPort,
    @Inject(TRIP_REPO) private readonly repo: TripRepository,
    private readonly events: EventBus,
  ) {}

  async execute(cmd: GenerateItineraryCommand): Promise<TripDto> {
    const candidates = await this.places.findWithinRadius(cmd.center, cmd.radiusKm, cmd.filters);
    const itinerary = await this.ai.planItinerary({ candidates, prefs: cmd.prefs });
    const trip = Trip.createDraft(cmd.userId, cmd.center, itinerary);
    await this.repo.save(trip);
    this.events.publish(new TripDraftedEvent(trip.id));
    return TripMapper.toDto(trip);
  }
}
```

Things to notice:

- Constructor takes **ports as DI tokens**, not concrete classes. The use-case doesn't know there's a Postgres on the other side of `TripRepository` — that's the infrastructure adapter's concern. Swapping Prisma for an HTTP client to a future Trip service is an adapter change, not a use-case change ([ADR-004](../adr/ADR-004-bounded-contexts.md) promise).
- `places`, `ai`, `repo` all cross-cut the application layer. The `EventBus` is the cross-context communication path ([ADR-003](../adr/ADR-003-event-backbone.md)).
- `execute` is **linear orchestration**. Read, compose, persist, publish, return. No branching logic beyond what the domain entities enforce.
- `Trip.createDraft(...)` is a **domain constructor** — the invariants (radius ≤ cap, center is valid lat/lng, days ≤ 30) live on the entity, not here. The use-case trusts the domain.
- The command (`GenerateItineraryCommand`) is a plain object. The Zod schema for it lives next door in the command file, not inlined into the use-case.

---

## Command shape (complement)

The command file that accompanies a use-case looks like this:

```ts
// modules/trip/application/generate-itinerary.command.ts
import { z } from 'zod';

export const GenerateItineraryCommandSchema = z.object({
  userId: z.string(),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radiusKm: z.number().positive().max(500),
  filters: z
    .object({
      /* ... */
    })
    .optional(),
  prefs: z
    .object({
      /* ... */
    })
    .optional(),
});

export type GenerateItineraryCommand = z.infer<typeof GenerateItineraryCommandSchema>;
```

The HTTP controller (interface layer) pipes its request body through `ZodValidationPipe(GenerateItineraryCommandSchema)` before the use-case sees it. The use-case's `cmd: GenerateItineraryCommand` parameter is therefore type-validated AT RUNTIME — not a TypeScript lie.

---

## What a use-case MUST NOT do

- **Do not catch `DomainError`.** Let it bubble. [`DomainExceptionFilter`](../../apps/api/src/common/filters/domain-exception.filter.ts) renders the JSON + trace id + HTTP status.
- **Do not `console.log` or import `pino` directly.** Use `@app/logger`'s `createLogger('<module>.<use-case>')` at module scope (CLAUDE.md rule 9).
- **Do not wrap network calls inside `prisma.$transaction`.** CLAUDE.md rule 13 — transactions must be fast; network I/O lives outside. If you need "save-then-publish" atomicity, use the [transactional outbox](../adr/ADR-003-event-backbone.md) pattern.
- **Do not reach into another module's internals.** `import { SafetyService } from '../../safety/application/...'` fails ESLint ([ADR-004](../adr/ADR-004-bounded-contexts.md)). Use the sibling's `interface/facade/` port or a domain event.
- **Do not return `null`.** Use `ResourceNotFoundError` / `NotFoundError` for "this thing doesn't exist" — that's domain state, not a return shape. Callers must `try/catch` OR let the filter serialise to a 404.
- **Do not store state on the use-case instance.** `@Injectable()` defaults to singleton scope. Anything on `this.` beyond the injected dependencies is a concurrency bug waiting to happen.

---

## Testing a use-case

Pure unit test. Ports are mocked; domain entities are real.

```ts
// modules/trip/application/generate-itinerary.use-case.spec.ts
describe('GenerateItineraryUseCase', () => {
  let uc: GenerateItineraryUseCase;
  let places: jest.Mocked<PlacesPort>;
  let ai: jest.Mocked<AiPort>;
  let repo: jest.Mocked<TripRepository>;
  let events: jest.Mocked<EventBus>;

  beforeEach(() => {
    places = { findWithinRadius: jest.fn() } as never;
    ai = { planItinerary: jest.fn() } as never;
    repo = { save: jest.fn() } as never;
    events = { publish: jest.fn(), subscribe: jest.fn() } as never;
    uc = new GenerateItineraryUseCase(places, ai, repo, events);
  });

  it('drafts a trip, persists it, then publishes TripDrafted in that order', async () => {
    places.findWithinRadius.mockResolvedValue([
      /* ... */
    ]);
    ai.planItinerary.mockResolvedValue({
      /* ... */
    });
    const save = repo.save.mockResolvedValue(undefined);

    await uc.execute({ userId: 'u1', center: { lat: 0, lng: 0 }, radiusKm: 10 });

    expect(save).toHaveBeenCalledBefore(events.publish as unknown as jest.Mock);
    expect(events.publish).toHaveBeenCalledWith(expect.any(TripDraftedEvent));
  });

  it('fails fast when the radius exceeds the domain cap', async () => {
    await expect(
      uc.execute({ userId: 'u1', center: { lat: 0, lng: 0 }, radiusKm: 501 }),
    ).rejects.toThrow(InvalidRadiusError);
    expect(ai.planItinerary).not.toHaveBeenCalled(); // Did NOT reach the AI call.
    expect(repo.save).not.toHaveBeenCalled(); // Did NOT persist.
    expect(events.publish).not.toHaveBeenCalled(); // Did NOT leak a partial event.
  });
});
```

Coverage threshold on `application/` is **≥ 80% lines** (CLAUDE.md self-check). Use-case tests are the fastest way to hit it — pure TS, no framework, run in milliseconds.

---

## Where use-cases live in the folder tree

```
apps/api/src/modules/<context>/
  application/
    <verb>-<subject>.use-case.ts          ← one file per use-case
    <verb>-<subject>.command.ts           ← Zod schema + inferred type
    <verb>-<subject>.use-case.spec.ts     ← unit test, ports mocked
    ports/                                 ← interfaces the use-case depends on
      <name>.port.ts                       ← `<Name>Port` + DI token
```

[ADR-001](../adr/ADR-001-modular-monolith.md) — `domain ← application ← infrastructure|interface` dependency rule.
[ADR-004](../adr/ADR-004-bounded-contexts.md) — only `interface/facade/` is importable from siblings.

---

## Links

- Playbook [§11.2 Use-Case Pattern](../../travel-app-playbook.md).
- [ADR-001](../adr/ADR-001-modular-monolith.md) — layer rule this pattern sits inside.
- [ADR-003](../adr/ADR-003-event-backbone.md) — `EventBus.publish` contract the pattern invokes.
- [ADR-004](../adr/ADR-004-bounded-contexts.md) — no direct sibling-module imports; facade ports only.
- [CLAUDE.md](../../CLAUDE.md) — rules 9, 11, 13 all apply inside use-cases.
- Prompt `[III.11.x]` (future) — the module template README will link back here as the authoritative use-case contract.
