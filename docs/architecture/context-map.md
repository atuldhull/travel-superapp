# Bounded-Context Map

> Source of truth for the 17 bounded contexts defined in Playbook §7.2. For every context this file records: **inbound events consumed · outbound events published · facade ports exposed · Prisma models owned**. Enforced by [ADR-004](../adr/ADR-004-bounded-contexts.md).
>
> **Installed by** `[II.7.2]`. **Update rule:** changing the owner of a Prisma model, adding/retiring an event name, or adding a facade port is a context-map edit AND either a superseding ADR (if it flips the rule) or a row change here (if it's an addition inside the rule). This doc is authoritative — module code must reflect it.

---

## Conventions

**Event names.** `PascalCase`, past tense, dot-prefixed with the publishing context. Example: `Trip.TripDrafted`, `Identity.UserRegistered`, `Safety.SosTriggered`. The publisher name is always the first segment — if `Trip` publishes it, it's `Trip.*`. Consumers subscribe by exact name (see `@app/events` contract in [ADR-003](../adr/ADR-003-event-backbone.md)).

> ⚠️ **Name collision:** Playbook §7.2 names one context "Events & Culture" and its entity `Event`. That word is also used for _domain events_ (the things on Redis Streams). In code, the aggregate stays `Event` (Playbook is source of truth), but in conversation and in this doc we write **`CulturalEvent`** whenever ambiguity would bite. The Prisma model remains `Event`.

**Facade port names.** `<Subject><Verb>Port` when a single port is too broad (e.g. `PlacesLookupPort` vs. a would-be god-interface `PlacesPort`). Per [ADR-004](../adr/ADR-004-bounded-contexts.md), facades live at `apps/api/src/modules/<context>/interface/facade/` and ARE the only surface a sibling module may import.

**Stateless contexts.** Translation and Analytics own no Prisma models (by design — Translation is a proxy to `ai-service`; Analytics is an event sink that forwards to PostHog / OpenTelemetry). Both appear in this doc for completeness with an explicit "no owned models" entry.

**Read-heavy vs. write-heavy contexts.** Some contexts (Identity, Places, Weather) are read-path suppliers — their facade port is the hot path. Others (Notifications, Analytics) are event-sink consumers with a thin or empty facade. This asymmetry is called out per-context.

---

## Summary Table

The 51-model ownership claim is reconciled in §"Model Ownership Index" at the bottom. The row order matches Playbook §7.2 strictly.

| #   | Context               | Inbound (consumes)                                                                                 | Outbound (publishes)                                                                                   | Facade ports                                                                          | Owns (Prisma)                                          |
| --- | --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Identity              | —                                                                                                  | `UserRegistered`, `UserDeleted`, `SessionRevoked`, `PreferencesUpdated`                                | `IdentityPort` (resolve user + preferences)                                           | `User`, `Session`, `Preferences`, `Device`             |
| 2   | Trip Planning         | `Places.PlaceReindexed`, `Safety.AreaRiskUpdated`, `Weather.SevereAlertIssued`                     | `TripDrafted`, `TripPublished`, `TripVersionSaved`, `TripDeleted`                                      | `TripReadPort` (read-only summaries for Social/Media/Analytics)                       | `Trip`, `ItineraryDay`, `ItineraryItem`, `TripVersion` |
| 3   | Places Catalog        | `Identity.UserDeleted`                                                                             | `PlaceIndexed`, `PlaceReindexed`, `PlaceRetired`                                                       | `PlacesLookupPort` (find by id + search by geo + relaxation score)                    | `Place`, `PlaceTag`, `PlaceEmbedding`                  |
| 4   | Stays                 | `Places.PlaceReindexed`, `Trip.TripDrafted`                                                        | `StayPriceRefreshed`, `StayBookingCreated`                                                             | `StaysQueryPort` (search + current-price lookup)                                      | `Stay`, `StayPrice`, `StayBooking`                     |
| 5   | Food & Tryouts        | `Places.PlaceReindexed`                                                                            | `EateryIndexed`, `DishReported`                                                                        | `FoodLookupPort` (dishes / eateries by place)                                         | `Eatery`, `Dish`, `DishTag`                            |
| 6   | Transport & Routing   | `Trip.TripDrafted`, `Places.PlaceReindexed`                                                        | `RouteComputed`, `TransitScheduleUpdated`                                                              | `TransportQueryPort` (compute leg + mode-fit)                                         | `RouteLeg`, `TransitSchedule`                          |
| 7   | Safety                | `Identity.UserDeleted`, `Places.PlaceReindexed`                                                    | `SosTriggered`, `ScamReported`, `AgentVerified`, `AreaRiskUpdated`                                     | `SafetyQueryPort` (time-of-day risk + scam DB lookup)                                 | `CrimeIncident`, `ScamReport`, `Agent`, `SosEvent`     |
| 8   | Weather & Environment | —                                                                                                  | `WeatherForecastRefreshed`, `SevereAlertIssued`                                                        | `WeatherPort` (forecast + alerts by geo)                                              | `WeatherForecast`, `Alert`                             |
| 9   | Events & Culture      | `Places.PlaceReindexed`                                                                            | `CulturalEventIndexed`, `CulturalEventRetired`                                                         | `EventsQueryPort` (cultural events by geo + window)                                   | `Event`, `EventSource`                                 |
| 10  | Translation           | —                                                                                                  | —                                                                                                      | `TranslationPort` (text / voice / OCR — proxy to ai-service)                          | _(none — stateless; cache lives in Redis)_             |
| 11  | Live Companion        | `Trip.TripPublished`, `Weather.SevereAlertIssued`, `Safety.AreaRiskUpdated`, `Safety.SosTriggered` | `GeofenceEntered`, `LiveReplanTriggered`                                                               | `LiveStatePort` (current geofence state for a trip)                                   | `Geofence`, `LiveEvent`                                |
| 12  | Social & Groups       | `Identity.UserDeleted`, `Trip.TripPublished`, `Trip.TripDeleted`                                   | `TripShared`, `ExpenseRecorded`, `ReviewPosted`                                                        | `SocialReadPort` (shares + votes for a trip)                                          | `TripShare`, `Vote`, `Expense`, `Review`               |
| 13  | Media & Memory        | `Identity.UserDeleted`, `Trip.TripPublished`                                                       | `MediaUploaded`, `MemoryBookBuilt`                                                                     | `MediaLookupPort` (signed URL + metadata by id)                                       | `MediaAsset`, `MemoryBook`                             |
| 14  | Payments              | `Identity.UserRegistered`, `Identity.UserDeleted`, `Safety.AgentVerified`                          | `SubscriptionActivated`, `SubscriptionCancelled`, `EscrowHeld`, `EscrowReleased`, `CommissionRecorded` | `PaymentsReadPort` (subscription status + escrow state by user)                       | `Subscription`, `EscrowHold`, `Commission`             |
| 15  | Notifications         | _(all outbound events from every context — see §"Notifications fan-in")_                           | `NotificationDispatched`, `NotificationFailed`                                                         | `NotificationsCommandPort` (explicit send for transactional flows that bypass events) | `NotificationPreference`, `NotificationLog`            |
| 16  | Analytics & Telemetry | _(all outbound events from every context — see §"Analytics fan-in")_                               | —                                                                                                      | _(no sync facade — analytics is pure event sink)_                                     | _(none — forwards to PostHog + OpenTelemetry)_         |
| 17  | Admin & Ops           | `Safety.ScamReported`, `Media.MediaUploaded`, `Social.ReviewPosted`, `Safety.AgentVerified`        | `FeatureFlagToggled`, `ModerationDecisionMade`                                                         | `FeatureFlagPort` (read current flags — consumed by every context)                    | `AdminUser`, `ModerationItem`, `FeatureFlag`           |

---

## Per-context Detail

The table above is the canonical reference. The notes below exist to answer "why" and to call out the non-obvious dependencies.

### 1. Identity

A pure **supplier**. Publishes user / session / preferences lifecycle events; consumes nothing. `UserDeleted` is the fan-out trigger for GDPR / DPDP erasure — every context that owns user-scoped rows subscribes to it and purges.

`IdentityPort` is the hot read-path port and caches aggressively (Redis, 60s TTL). Nothing outside Identity writes to `User` / `Session` / `Preferences` / `Device`.

### 2. Trip Planning

Central **consumer-hub** — a trip aggregates almost everything the product knows. Consumes reindex / risk / weather-alert signals to flag stale drafts. Publishes the lifecycle events that Live, Social, Media, Analytics all key off.

Note: `TripReadPort` returns summaries only — never the full aggregate. Sibling modules that want full trip state should subscribe to `TripPublished` and project what they need into their own read model.

### 3. Places Catalog

A **supplier** the way Identity is a supplier — `PlacesLookupPort` is used by Trip, Stays, Food, Transport, Safety, Events, Social. The federated search (Google + FSQ + OSM + dedup + relaxation score) is heavy; every caller goes through the port so caching + circuit breakers sit in one place.

Embeddings (`PlaceEmbedding`, `vector(1024)`) are owned here because the enrichment pipeline that writes them lives here. Consumers treat them as read-only and query through the port — never via Prisma directly.

### 4. Stays / 5. Food / 6. Transport / 9. Events & Culture

All four are **Place-dependent leaf contexts** with similar shapes: they re-denormalise when Places publishes `PlaceReindexed`, they expose a query port scoped by geo or trip, and their outbound events feed Notifications + Analytics.

Transport specifically consumes `TripDrafted` so it can precompute leg feasibility for the draft itinerary.

### 7. Safety

Has the richest **outbound event surface** of any context: `SosTriggered` (highest priority — wakes Notifications + Admin immediately), `AreaRiskUpdated` (consumed by Trip + Live), `ScamReported` (goes to Admin moderation), `AgentVerified` (Payments needs this to allow escrow).

`SafetyQueryPort` is sync because trip-planning decisions need real-time risk scoring.

### 8. Weather & Environment

Proxy-with-cache pattern. `WeatherPort` is sync for reads; `SevereAlertIssued` is async for pushy alerts. Trip + Live both subscribe — Trip to warn about drafts, Live to trigger re-plans.

### 10. Translation

Stateless. `TranslationPort` forwards to `ai-service` (see [ADR-003](../adr/ADR-003-event-backbone.md) + the forthcoming service contract from `[II.7.3]`). Redis cache layer keeps it off the ai-service hot path for common phrases.

### 11. Live Companion

Is **the** consumer of cross-context events that have to happen _during_ a trip. `Trip.TripPublished` seeds the geofence set; `Weather.SevereAlertIssued` + `Safety.AreaRiskUpdated` + `Safety.SosTriggered` all trigger re-plans.

`LiveStatePort` is tight — other modules can ask "is this trip currently live?" but cannot read individual geofences.

### 12. Social / 13. Media

Both subscribe to `Identity.UserDeleted` for erasure, and `Trip.TripPublished` to light up after-the-fact features (sharing, memory-book build). Neither writes to Trip-owned tables.

### 14. Payments

The only context that subscribes to `Safety.AgentVerified` — Stripe Connect escrow for an agent requires that the agent has cleared KYC. `SubscriptionActivated` is the entitlement gate that Identity's premium-feature checks depend on (Identity reads via `PaymentsReadPort`, NOT by subscribing to events — this is a sync requirement).

### 15. Notifications (fan-in)

Consumes, at minimum: `Trip.TripPublished`, `Trip.TripVersionSaved`, `Safety.SosTriggered`, `Safety.ScamReported`, `Safety.AreaRiskUpdated`, `Weather.SevereAlertIssued`, `Live.GeofenceEntered`, `Live.LiveReplanTriggered`, `Stays.StayBookingCreated`, `Payments.SubscriptionActivated`, `Payments.SubscriptionCancelled`, `Social.TripShared`, `Social.ReviewPosted`, `Media.MemoryBookBuilt`. The exact fan-in list belongs in `apps/notification-worker/src/events.ts` and is kept in sync with this doc.

Dispatch is DND / quiet-hours aware (reads `NotificationPreference`, which Identity's preference-updates keep fresh via `PreferencesUpdated`).

### 16. Analytics & Telemetry (fan-in)

Subscribes to **every** outbound event from every other context (wildcard subscription at the `@app/events` boundary). Forwards to PostHog (product analytics) and OpenTelemetry (traces + metrics). Owns no Prisma models; no facade port — nobody reads from Analytics.

### 17. Admin & Ops

Owns platform-cross-cutting state (`FeatureFlag`, `AdminUser`, `ModerationItem`). `FeatureFlagPort` is consumed by every context — it's the one sync-read exception to "contexts are independent" because feature gating is cross-cutting by design. Consumes moderation-relevant events (scam reports, new media, new reviews, new agents) to populate the moderation queue.

---

## Cross-cutting fan-in / fan-out diagram

```
                      ┌──────────────┐
     UserRegistered ──┤   Identity   ├── UserDeleted ──► (every context that owns user-scoped data)
  PreferencesUpdated ─┤              │
                      └──────┬───────┘
                             │ (via IdentityPort — sync read)
                             ▼
┌──────────┐       ┌──────────┐       ┌──────────┐      ┌────────────┐
│  Places  │──────►│   Trip   │◄──────│  Safety  │─────►│    Live    │
│ (port +  │       │ (hub)    │       │ (events) │      │  (subscr.) │
│  events) │       └────┬─────┘       └────┬─────┘      └─────┬──────┘
└────┬─────┘            │                  │                  │
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
┌────────┐      ┌─────────────┐    ┌───────────────┐  ┌─────────────┐
│ Stays  │      │Notifications│    │    Admin      │  │  Analytics  │
│ Food   │      │ (fan-in ALL)│    │ (moderation)  │  │ (fan-in ALL)│
│Transport│     └─────────────┘    └───────────────┘  └─────────────┘
│ Events  │
│ Media   │
│ Social  │
└────────┘
```

Suppliers on the left (Places is the main one after Identity), hub in the middle (Trip), terminal consumers on the right (Notifications, Admin, Analytics).

---

## Model Ownership Index (acceptance check)

Every Prisma model mentioned in Playbook §7.2 (Key entities column) and §12 (schema highlights + required indexes) appears below **exactly once**. This is the file reviewers grep during a PR that touches `prisma/schema.prisma` to make sure a new model lands under the right owner.

| Model                    | Owner context          |
| ------------------------ | ---------------------- |
| `User`                   | 1. Identity            |
| `Session`                | 1. Identity            |
| `Preferences`            | 1. Identity            |
| `Device`                 | 1. Identity            |
| `Trip`                   | 2. Trip Planning       |
| `ItineraryDay`           | 2. Trip Planning       |
| `ItineraryItem`          | 2. Trip Planning       |
| `TripVersion`            | 2. Trip Planning       |
| `Place`                  | 3. Places Catalog      |
| `PlaceTag`               | 3. Places Catalog      |
| `PlaceEmbedding`         | 3. Places Catalog      |
| `Stay`                   | 4. Stays               |
| `StayPrice`              | 4. Stays               |
| `StayBooking`            | 4. Stays               |
| `Eatery`                 | 5. Food & Tryouts      |
| `Dish`                   | 5. Food & Tryouts      |
| `DishTag`                | 5. Food & Tryouts      |
| `RouteLeg`               | 6. Transport & Routing |
| `TransitSchedule`        | 6. Transport & Routing |
| `CrimeIncident`          | 7. Safety              |
| `ScamReport`             | 7. Safety              |
| `Agent`                  | 7. Safety              |
| `SosEvent`               | 7. Safety              |
| `WeatherForecast`        | 8. Weather             |
| `Alert`                  | 8. Weather             |
| `Event` (CulturalEvent)  | 9. Events & Culture    |
| `EventSource`            | 9. Events & Culture    |
| `Geofence`               | 11. Live Companion     |
| `LiveEvent`              | 11. Live Companion     |
| `TripShare`              | 12. Social & Groups    |
| `Vote`                   | 12. Social & Groups    |
| `Expense`                | 12. Social & Groups    |
| `Review`                 | 12. Social & Groups    |
| `MediaAsset`             | 13. Media & Memory     |
| `MemoryBook`             | 13. Media & Memory     |
| `Subscription`           | 14. Payments           |
| `EscrowHold`             | 14. Payments           |
| `Commission`             | 14. Payments           |
| `NotificationPreference` | 15. Notifications      |
| `NotificationLog`        | 15. Notifications      |
| `AdminUser`              | 17. Admin & Ops        |
| `ModerationItem`         | 17. Admin & Ops        |
| `FeatureFlag`            | 17. Admin & Ops        |

**Count: 43 models · 43 single-owner rows · 0 conflicts.**

Contexts that intentionally own no models: **10. Translation** (proxy), **16. Analytics & Telemetry** (event sink). Both are noted explicitly in the Summary Table.

### Shared / lookup tables — placed in the context that writes them

- `emailHash` (unique index from §12.4) lives on `User` → Identity.
- Playbook §12.4's `CrimeIncident @@index([lat, lng, reportedAt])` confirms `CrimeIncident` belongs to Safety.
- Playbook §12.4's `NotificationLog @@index([userId, read, createdAt])` confirms `NotificationLog` belongs to Notifications.
- Playbook §12.1's example models `Trip` and `PlaceEmbedding` map to Trip Planning and Places Catalog respectively — matches this table.

---

## How to use this doc

- **Reviewing a PR** that adds a Prisma model → find it in the Index; if missing, the PR must either add a row here (adding a model to an existing owner) or propose a new bounded context via an ADR (never both silently).
- **Writing a new facade** → the facade goes in the owner's `interface/facade/`; this doc's row is updated in the same PR.
- **Introducing a new cross-context dependency** → if sync: add a row to the owner's "Facade ports" column; if async: add a row to both "Outbound" (on the publisher) and "Inbound" (on the subscriber) columns.
- **Retiring an event** → flip the row to ~~strikethrough~~ in the same PR that removes the publisher code, and delete the row one release after the last consumer has been dropped.

## Links

- [ADR-001](../adr/ADR-001-modular-monolith.md) — layer rule within a module.
- [ADR-003](../adr/ADR-003-event-backbone.md) — Redis Streams + `@app/events` contract.
- [ADR-004](../adr/ADR-004-bounded-contexts.md) — cross-module rule this doc operationalises.
- Playbook §7.2 (module map), §12 (schema highlights + indexes).
- Prompt `[II.7.3]` — service contracts for the 4 extracted services (complements this doc with the things that _aren't_ modules).
- Prompt `[II.7.4]` — shared-package manifest (complements this doc with the things modules are _allowed_ to import).
