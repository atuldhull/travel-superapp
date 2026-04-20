# ADR-010 — Delete policy: anonymise-on-delete, no soft-delete middleware

- **Status:** Accepted
- **Date:** 2026-04-20
- **Prompt:** `[III.12.6]`
- **Playbook reference:** §12.6 (pick-one rule) + §30.2 (GDPR / DPDP propagation)

## Context

Users split into two real cohorts when it comes to data:

- **"Keep my data."** Users who might come back. For them, the question isn't about deletion at all — it's about _dormancy_ (account hidden, data preserved).
- **"Get it gone."** Users who actively hit DELETE. They clicked the button. They mean it. Most jurisdictions give them a statutory right (GDPR Art. 17, India DPDP §12) that requires _actual_ erasure or irreversible anonymisation — a `deletedAt` flag in a column does not satisfy a regulator.

Two patterns compete:

- **A.** Soft-delete everywhere via a Prisma middleware filter. Every table grows a `deletedAt DateTime?`; middleware appends `WHERE "deletedAt" IS NULL` to every query; deletes become `UPDATE ... SET "deletedAt" = now()`. Data stays recoverable forever.
- **B.** Anonymise-on-delete only. Hard-delete where FK integrity allows. Where it doesn't (rows that other tables reference — Trips authored, Reviews written, Commissions paid), **overwrite PII in place** so the row remains structurally valid but identity-erased. Accounts default to active; dormancy is a separate concern handled by an explicit status transition, not a schema-wide flag.

The choice drives ~40 tables' shape, the ORM access layer, and the compliance playbook.

## Decision drivers

- **GDPR / DPDP compliance, not convenience.** The erasure right is non-negotiable. A soft-delete flag leaves personal data at rest; regulators read that as "still processing". Option A either requires a separate hard-delete sweep on top (now we have both) OR it fails audit.
- **The two user cohorts don't need the same mechanism.** "Keep my data" users never hit delete — they go dormant, log back in, pick up where they left off. "Get it gone" users need real erasure. Soft-delete serves neither group particularly well: the first cohort needs nothing special, the second needs actual deletion.
- **Middleware-based soft-delete is a known footgun.** Every new table must be wired into the middleware or it silently leaks. Every raw-SQL path (`GeoQueries`, `VectorQueries`, any `$queryRaw`) bypasses the middleware and returns deleted rows. At 43 tables + multiple raw-SQL wrappers already in play, the cost of getting this right is real.
- **Referential integrity preserved.** A deleted User's Trips, Reviews, Expenses etc. are structurally entangled with other users' data (group trips, expense splits). Hard-deleting the User would either orphan those rows or require wide cascades that violate other users' history. Anonymisation-in-place keeps the graph valid and everyone else's history intact.
- **The schema already leans this way.** `User.deletedAt` is the ONLY soft-delete column in [III.12.1]'s schema (Playbook §12.6 was explicit about not mix-and-matching). Option B ratifies the existing shape; option A requires a schema-wide sweep to add `deletedAt` + every associated index to 40+ tables.
- **Two users in the same group trip, one deletes their account.** Option A quietly hides the deleted user's ItineraryItems from everyone, including the other traveller — breaking the group's shared trip view. Option B anonymises the deleted user's authored rows and leaves the group trip intact; everyone else's experience is unaffected.

## Considered options

### A. Soft-delete everywhere + Prisma middleware filter

- **Shape:** add `deletedAt DateTime?` to every table. Middleware injects `WHERE "deletedAt" IS NULL` into every query. Delete = `UPDATE`.
- **Pros:** trivially recoverable by flipping `deletedAt` back to null. Admin queries can override.
- **Cons:**
  - Does not satisfy GDPR / DPDP erasure on its own — still need an anonymise/purge sweep layered on top, so we end up implementing B anyway.
  - 40+ schema changes, 40+ new indexes on `deletedAt`, migration sweep across every model.
  - Every raw-SQL path (we have two already) must manually filter, or leak.
  - Group-data failure mode: deleting user A hides A's contributions to user B's shared trip.
  - Middleware-invisible bugs (query somehow bypasses middleware → leaks deleted data) are silent and hard to catch.

### B. Anonymise-on-delete only · **CHOSEN**

- **Shape:** accounts default to active. An explicit `DELETE /users/me` flow publishes `Identity.UserDeleted` on the event bus; each context anonymises its user-scoped rows in place (Playbook §30.2 propagation flow). After a 30-day grace window a hard-purge job removes anything safe to hard-delete.
- **Pros:**
  - Compliance-aligned by construction; the propagation flow _is_ the GDPR erasure path.
  - No schema-wide sweep; uses the event bus we already have ([ADR-003](./ADR-003-event-backbone.md)).
  - Referential integrity preserved — other users' history of the deleted user's participation stays intact, just with their identity blanked.
  - Middleware-free; raw-SQL paths stay raw-SQL. Simpler.
- **Cons:**
  - Not recoverable. A deleted account is gone. Users must export their data (via the GDPR Art. 20 endpoint, Playbook §30.3) before deleting if they want a copy.
  - Each context needs to know how to anonymise its own rows — more moving pieces than a single middleware.
  - 30-day grace window adds process complexity (cron job; pending_hard_delete table; operator ability to rescind a DELETE within the window).

### C. Hybrid (mentioned for completeness — NOT chosen)

- **Shape:** soft-delete middleware for "safe" tables + anonymise-on-delete for user-scoped.
- **Rejected:** combines the worst of both — we still pay Option A's middleware complexity AND Option B's propagation, and have to remember which kind of table each one is on every PR.

## Decision outcome

**Chose option B — anonymise-on-delete only.**

`User.deletedAt` stays as the single schema-level soft-delete flag. It marks "anonymisation complete; row scheduled for hard-purge at `deletedAt + 30 days`." No other table grows a `deletedAt` column.

The "keep my data" cohort is served by a **separate, orthogonal** mechanism: account **deactivation** (coming with the identity module, `[III.13.2]`). Deactivation hides the account and suspends sessions WITHOUT touching data or triggering the erasure flow. Users toggle back to active with no data loss. This is the right primitive for "I don't want to use the app right now" — it is NOT a deletion.

### Affected models (per-context anonymisation plan)

This is the list of rows that need explicit handling when `Identity.UserDeleted` fires. Implementation lands in each module's prompt. The ADR is the binding rule.

| Context                                                                  | Model                            | Action on `UserDeleted`                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                                                                 | `User`                           | Overwrite PII: `emailEncrypted`, `emailHash`, `passwordHash`, `displayName`, `avatarUrl`, `mfaSecret`. Set `deletedAt = now()`. Retain `id` + `createdAt` + `role` for FK targets.                  |
| Identity                                                                 | `Session`                        | Hard-delete all (cascade from `User` via `onDelete: Cascade` in the schema).                                                                                                                        |
| Identity                                                                 | `Preferences`                    | Hard-delete (cascade).                                                                                                                                                                              |
| Identity                                                                 | `Device`                         | Hard-delete (cascade; push tokens gone too).                                                                                                                                                        |
| Trip                                                                     | `Trip`                           | Retain. Keep `userId` pointing at the anonymised User. Title/notes keep; they're the user's content.                                                                                                |
| Trip                                                                     | `TripVersion`                    | Retain. `authorId` points at the anonymised User.                                                                                                                                                   |
| Trip                                                                     | `ItineraryDay` / `ItineraryItem` | Retain (cascade from Trip).                                                                                                                                                                         |
| Social                                                                   | `Review`                         | Anonymise author to a "Former traveller" marker + LLM-sanitise `body` to strip PII (§30.2).                                                                                                         |
| Social                                                                   | `Expense` / `Vote` / `TripShare` | Retain if another user is still a participant. Hard-delete if the deleting user was the sole participant.                                                                                           |
| Media                                                                    | `MediaAsset`                     | Hard-delete all `ownerId = deletedUser`. S3 objects purged by media-service via `MediaDeletionRequested` side-event. 30-day archival per §30.2 runs in a separate archive bucket, not the main one. |
| Media                                                                    | `MemoryBook`                     | Hard-delete all owned (cascade from User).                                                                                                                                                          |
| Payments                                                                 | `Subscription`                   | Retain. Stripe sub cancelled. Scrub `stripeCustomerId` AFTER final invoice (legal retention — 7y in most jurisdictions).                                                                            |
| Payments                                                                 | `EscrowHold`                     | Retain active + resolved records for 7 years (financial law). Scrub `userId` → anonymised ref.                                                                                                      |
| Payments                                                                 | `Commission`                     | Retain for 7 years.                                                                                                                                                                                 |
| Notifications                                                            | `NotificationPreference`         | Hard-delete (cascade).                                                                                                                                                                              |
| Notifications                                                            | `NotificationLog`                | Hard-delete; audit metadata (no payload) archived for 90 days.                                                                                                                                      |
| Safety                                                                   | `ScamReport`                     | Retain. Reporter anonymised; report body scanned for PII and LLM-sanitised.                                                                                                                         |
| Safety                                                                   | `SosEvent`                       | Retain 12 months for pattern analysis with `userId` blanked, then hard-delete.                                                                                                                      |
| Safety                                                                   | `Agent`                          | KYC records — retain per jurisdiction, scrub personal identifiers per national rule.                                                                                                                |
| Live                                                                     | `Geofence` / `LiveEvent`         | Hard-delete all `userId = deletedUser`.                                                                                                                                                             |
| Places / Stays / Food / Events / Weather / Transport / Analytics / Admin | —                                | No user-scoped rows. Unaffected by the event.                                                                                                                                                       |

Contexts not listed above hold no user-scoped data.

## Consequences (binding)

- **`User.deletedAt` is the only soft-delete column in the schema.** Adding a `deletedAt` to any other table requires a superseding ADR.
- **No Prisma middleware for row filtering.** Ever. Queries return exactly the rows they select. If you need to exclude anonymised Users, filter explicitly: `{ where: { deletedAt: null } }`.
- **Every context that owns user-scoped data MUST subscribe to `Identity.UserDeleted`** on the event bus ([ADR-003](./ADR-003-event-backbone.md)) and implement its row of the table above. A new context that introduces user-scoped state without a subscription fails review.
- **A 30-day grace window** sits between anonymisation (`deletedAt` set) and hard-purge (cron-driven). Within that window, an operator can rescind the deletion — account comes back; anonymised fields cannot be restored from DB state and must be re-supplied by the user. Playbook §30.2.
- **Account deactivation is a separate primitive**, not a deletion. Lands with `[III.13.2]` (identity module). Deactivation is reversible with full data intact; deletion is not.
- **The GDPR export endpoint** (Playbook §30.3) MUST run BEFORE deletion. The UI gates "DELETE account" behind a banner offering "Download my data first" that defaults to expanded.

## Re-evaluation triggers

- A regulator objects to our anonymise-in-place approach for a specific row class — the ADR gets revised for that class.
- A Sev-1 data-restore incident suggests we need stronger recoverability at the row level — evaluate narrow soft-delete on the affected context only (NOT a schema-wide sweep), with a superseding ADR.
- The total compliance burden of per-context anonymisation exceeds the soft-delete middleware's footgun cost (unlikely at our scale, but possible at 100+ modules).

## Links

- Playbook §12.6 (pick-one rule) · §30.2 (erasure propagation) · §30.3 (GDPR export).
- [ADR-001](./ADR-001-modular-monolith.md) — contexts publish + subscribe to `UserDeleted` per this ADR.
- [ADR-003](./ADR-003-event-backbone.md) — `Identity.UserDeleted` is the transport.
- [ADR-004](./ADR-004-bounded-contexts.md) — each context's subscription goes via its facade / event consumer.
- [context-map](../architecture/context-map.md) — `UserDeleted` is already in every user-scoped context's "Inbound" column.
- Prompt `[III.13.2]` — account deactivation (separate primitive, lands with identity module).
- Prompt `[VI.30.2]` — implementation of the erasure propagation worker.
