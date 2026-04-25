# ADR-013 — Per-section graceful degradation in composite endpoints

- **Status:** Accepted
- **Date:** 2026-04-26
- **Prompt:** `[IV.18.19.7]` (codifies the pattern shipped in `[IV.18.7.3]` and reused by `[IV.18.6.5]`, `[IV.18.7.7]`, `[IV.18.12.11..12]`)
- **Playbook reference:** §3.2 (Trip overview composite) + §11 (SLO posture)

## Context

Trip overview is the heaviest composite endpoint: one `GET /trips/:id/overview` fans out to 7 concurrent sub-fetches (itinerary, weather, stays, eateries, events, transport, media). Some of those sub-fetches reach external providers (Open-Meteo, eatery APIs, mock-stay providers). Some fail in predictable ways: a dateless trip can't search stays, a transport adapter can be unreachable, a flaky weather provider can 5xx.

The naive approach — `Promise.all`, propagate any rejection — turns one flaky widget into a 500 across the whole dashboard. A frontend that 500s because one panel failed is a worse UX than a frontend with one panel greyed out.

We needed to decide: **fail-fast on any sub-fetch error, or per-section graceful degradation?**

## Decision drivers

- **Composite reads are ultimately UI scaffolding.** The frontend renders 7 panels, each independently. The contract should match the rendering shape: each panel either succeeds with data, or fails with a code the UI can branch on.
- **`Promise.all` rejects on first failure** — wrong primitive. `Promise.allSettled` is closer but loses the typed "ok/code" shape.
- **Section-level errors are recoverable client-side.** A "weather temporarily unavailable" panel can show a retry button; a 500 across the whole dashboard cannot.
- **Section-level errors can be product errors, not infrastructure errors.** "This trip has no dates so we can't search stays" is a known, named state — `TRIP_DATES_REQUIRED`. The composite shouldn't 500 just because the user hasn't filled in their dates yet.
- **The owner-gate stays at the top.** We don't want partial degradation to leak data — if the user can't access the trip at all, no sections render. The gate runs once before any sub-fetch.

## Decision

Adopt a **`Section<T>` discriminated union** as the per-panel return type:

```ts
export type Section<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string };
```

Wrap each sub-fetch in a `section()` helper that runs the producer, catches any throw, and surfaces the error as `{ ok: false, code }`. Use a `GracefulSkip` marker class to surface known "skip reasons" (e.g. `TRIP_DATES_REQUIRED`) cleanly without conflating them with infra errors. Domain errors expose a `code` string that the wrapper picks up; plain errors collapse to `INTERNAL_ERROR`.

```ts
async function section<T>(producer: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await producer() };
  } catch (err) {
    return { ok: false, code: coerceCode(err) };
  }
}

class GracefulSkip extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
```

The composite use-case (`GetTripOverviewUseCase`) wraps every sub-fetch in `section()` inside one `Promise.all` so all 7 run concurrently. Failures of one don't reject the others.

## Consequences

**Positive:**

- 7-section composite shipped without any "dashboard 500" failure mode.
- Same pattern reused for the `[IV.18.12.11..12]` review-bundle composite — `votes` block returns zero-filled when the `targetType` doesn't match a vote target.
- Clients render greyed-out panels with a known code instead of a generic error.
- New panels added later opt into degradation by default — wrapping in `section()` is the only addition needed.

**Negative / open:**

- The `code` namespace is informal — consumers branch on string equality, not a typed enum. A typed catalog would be safer; reserved for v2 once the codes stabilise.
- A section that succeeds with empty data (`{ ok: true, data: [] }`) and a section that gracefully skipped (`{ ok: false, code: 'TRIP_DATES_REQUIRED' }`) are different responses — clients have to handle both. This is intentional but worth knowing: empty != skipped.
- The section wrapper swallows the original stack trace. The trace is still in the `traceId` log line emitted by the underlying use-case; ops correlate via that, not via the API response.

## Cross-references

- `[IV.18.7.3]` — original 5-section overview
- `[IV.18.7.5]` — Events section added — wrapped in `section()` like the others
- `[IV.18.12.10]` — Media section added via `forwardRef()` cross-module port
- `[IV.18.12.11..12]` — Review-bundle composite reuses the pattern with the `votes` block returning zero-filled for non-place review-target types
- `[IV.18.2.15]` — TripOverviewCache caches the assembled DTO; partial-degradation responses cache same as full-success ones
