# ADR-012 — Owner-scoped `updateMany` + count gate as the universal write pattern

- **Status:** Accepted
- **Date:** 2026-04-26
- **Prompt:** `[IV.18.19.7]` (codifies the pattern shipped across `[IV.18.2.x]`, `[IV.18.12.x]`, `[IV.18.15.x]`, `[IV.18.18.x]`)
- **Playbook reference:** §9 (Security — IDOR defence) + §3.2 (Trip CRUD)

## Context

Almost every authenticated mutation in this codebase has the same shape:

1. The HTTP layer extracts `user.sub` from the JWT.
2. The handler wants to update / delete a row that belongs to that user.
3. Wrong-id and wrong-owner must both look identical to the caller (404 not 403) so an attacker probing the id space can't enumerate ownership.
4. The check + the write must be atomic — a check-then-write window is an IDOR race.

We had two ways to express this:

- **A.** `findFirst({ where: { id, ownerId: userId } })` then `update({ where: { id }, data: ... })`.
- **B.** `updateMany({ where: { id, ownerId: userId }, data: ... })` and gate on `result.count === 1`.

This ADR ratifies **B** as the universal pattern. It now appears in 30+ adapter methods.

## Decision drivers

- **Atomicity.** Option A is two round-trips. A row could be deleted (or its owner could change, in a future world) between the `findFirst` and the `update`. Option B is one SQL statement.
- **IDOR-safe by collapse.** Option B's "did the gate match?" comes from `count !== 1`, which is identical for "id doesn't exist" and "id belongs to someone else". Mapping that to a 404 at the use-case layer is automatic. Option A makes it tempting to throw different errors for "not found" vs "not authorised" — and then a careful attacker counts the difference.
- **Idempotent writes are free.** `updateMany({ where: { id, ownerId }, data: { read: true } })` on an already-read row still returns `count = 1` because Postgres updates the row even when values match. The use-case layer is naturally idempotent against retries.
- **Read-back without a second roundtrip is cheap.** When the caller needs the updated row (mark-read returns the row), `findUnique({ where: { id } })` after the gate matched IS a second roundtrip — but it's only on the success path. Failure path returns `null` immediately; the use-case maps to 404 without any extra work.
- **Pattern repetition is a feature.** Engineers reading the 30th instance see the same shape they saw in the 1st. New writes copy it without thinking.

## Decision

**Every owner-scoped write uses `updateMany` + `count === 1` gate.** When the caller needs the updated row, follow the gate with a `findUnique({ where: { id } })`. Map `count !== 1` → `null` → 404 at the use-case layer.

Concrete shape:

```ts
async markReadForUser(id: string, userId: string): Promise<NotificationLog | null> {
  const result = await this.prisma.notificationLog.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  if (result.count !== 1) return null;
  const row = await this.prisma.notificationLog.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}
```

For deletes:

```ts
async deleteForUser(id: string, userId: string): Promise<boolean> {
  const result = await this.prisma.notificationLog.deleteMany({
    where: { id, userId },
  });
  return result.count === 1;
}
```

## Consequences

**Positive:**

- 30+ instances across Trip / Media / MemoryBook / Notification / Vote / Expense / Review / Account modules — same shape, same security guarantee.
- New engineers grok the pattern by example; no docs lookup needed.
- IDOR coverage is "free" — wrong-owner = wrong-id at the response layer.
- The pattern extends cleanly to admin verbs: admin `updateMany({ where: { id } })` (no owner clause) is the natural relaxation; the count-gate stays.
- Bulk writes (`mark-all-read`) reuse the shape — `updateMany({ where: { userId, read: false }, data: { read: true } })` returns `result.count` as the marked-row count, which the use-case layer surfaces as `{ marked: N }`.

**Negative / open:**

- Tests that want to assert "this 404 was the cross-user case, not the missing-id case" can't — by design, the cases are indistinguishable from the response. A test that wants to pin both branches independently has to seed both fixtures and check the underlying row state separately.
- For writes that need to return the updated row, we pay one extra `findUnique` round-trip on the success path. Acceptable: it's an indexed PK lookup.
- The "atomic transition" variant ([Trip status archive/unarchive]) layers an additional `where` clause (`where: { id, ownerId, status: 'active' }`) — so retrying an `archive` on an already-archived trip returns `count === 0`. The use-case layer maps that to 409 (`STATUS_TRANSITION_INVALID`) instead of 404. Documented in [IV.18.2.4] and [IV.18.18.3].

## Variants ratified by this ADR

| Variant                          | Where clause additions                        | Failure mapping                                 |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Standard owner-scoped write      | `{ id, userId }`                              | count !== 1 → 404                               |
| Owner-scoped delete              | `{ id, userId }`                              | count !== 1 → 404                               |
| Bulk owner-scoped write          | `{ userId, <selector for unprocessed rows> }` | count = N (not gated)                           |
| Atomic-transition write          | `{ id, userId, <current-state> }`             | count !== 1 → 409 (`STATUS_TRANSITION_INVALID`) |
| Admin write (no owner)           | `{ id }`                                      | count !== 1 → 404                               |
| Cross-module bidirectional write | `{ id, ownerId }` (each direction)            | count !== 1 → 404                               |

## Cross-references

- [ADR-002 — Service extraction triggers](./ADR-002-service-extraction-triggers.md) — the same atomic-write rule applies to extracted services
- [ADR-009 — DevOps](./ADR-009-devops.md) — production hardening assumes IDOR safety at the data layer
- `[IV.18.2.x]` — Trip CRUD (first appearance)
- `[IV.18.12.6..7]` — MemoryBook update + delete + publish/unpublish
- `[IV.18.15.2]` `[IV.18.15.3]` `[IV.18.15.5]` `[IV.18.15.6]` — Notification mark-read / mark-all-read / mark-unread / delete
- `[IV.18.18.4]` — admin media moderation (admin variant — `updateMany` without owner clause)
