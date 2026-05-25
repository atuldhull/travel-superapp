# @app/clock

Injectable `Clock` service — `SystemClock` (production) and `FakeClock`
(tests).

## Why

The review's "control time" item:

- Hardcoded `const TOMORROW = new Date('2026-05-17')` rots into a
  bug as the wall clock moves past the literal.
- `new Date()` / `Date.now()` inline in production code can't be
  deterministically driven from a test.
- Background schedulers / token TTLs / "is this trip in the past"
  predicates all want a seam for fast-forward.

## API

```ts
import { CLOCK, Clock, SYSTEM_CLOCK, SystemClock, makeFakeClock } from '@app/clock';

// Production code — inject via Nest DI.
@Injectable()
class PublishTripUseCase {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  execute(trip: Trip): void {
    if (trip.startsOn.getTime() < this.clock.nowMs()) {
      throw new Error('cannot publish a trip in the past');
    }
  }
}

// Composition root — wired GLOBALLY in apps/api by `ClockModule`
// (apps/api/src/common/clock/clock.module.ts), so every feature
// module gets CLOCK without an explicit import. Just inject it.
//
// If you're wiring a different Nest app (worker, ai-service-node),
// register the provider once at the composition root:
//   { provide: CLOCK, useValue: SYSTEM_CLOCK }

// Tests — bind to a controllable FakeClock and roll time forward.
const clock = makeFakeClock(new Date('2026-05-24T12:00:00Z'));
const useCase = new PublishTripUseCase(clock);

// fast-forward 3 days
clock.advance(3 * 86_400_000);
```

## Migration pattern

This package is the SEAM. Migration of existing `new Date()` /
`Date.now()` call sites is per-feature follow-up; the cost-benefit
favors landing the seam globally and migrating one use-case at a time
when it gains a test that needs it.

Quick audit (in `apps/api/src`):

```bash
grep -rln "new Date()\|Date\.now()" apps/api/src/modules | wc -l
```

When migrating a call site:

1. Add `@Inject(CLOCK) private readonly clock: Clock` to the
   use-case constructor (or accept `clock: Clock` as a pure-function
   parameter for domain code).
2. Replace `new Date()` → `this.clock.now()` and `Date.now()` →
   `this.clock.nowMs()`.
3. The Nest module's providers list adds `{ provide: CLOCK, useValue:
SYSTEM_CLOCK }` if it isn't already on the parent module.
4. The test substitutes `makeFakeClock(initial)` and asserts via
   `clock.advance(ms)`.

## Pre-existing `now = new Date()` parameter pattern

Several call sites already pass `now: Date = new Date()` as a default
parameter (e.g. `apps/api/src/modules/trip/domain/trip-transitions.ts`'s
`markLocked(trip, now)`). Those are manual clock injection in disguise
— callers can pass `clock.now()` directly, no refactor needed. The
`@app/clock` package just standardises the name + provides
`makeFakeClock()` so tests use the same primitive instead of inlining
their own `let now = Date.now()` mutable cells.
