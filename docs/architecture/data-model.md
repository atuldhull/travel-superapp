# Data model — ERD

> **Generated** by [`scripts/docs-emit-erd.mjs`](../../scripts/docs-emit-erd.mjs) from [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma). Do NOT edit by hand — re-run `pnpm docs:erd` after a schema change. The CI drift gate fails any PR that touches the schema without regenerating this file.
>
> Models: **64** · Enums: **14** · Clusters: **8** (matches [`c4/components-api.md`](./c4/components-api.md)).

## How to read

- One **Mermaid erDiagram** per cluster — boxes are models, lines are foreign-key relations within the cluster.
- Cardinality on the diagrams is shown as `}o--o{` (generic association) — the precise type lives in [`schema.prisma`](../../apps/api/prisma/schema.prisma); duplicating it here would only invite drift.
- Up to 6 representative scalar/enum fields per box (id + 5). Relation fields are shown as edges, not as box rows.
- **Cross-cluster relations** are listed at the bottom in a table — those are the seams between bounded contexts.

## Model-ownership index (64 models)

| Cluster         | Models                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity        | `User`, `BanAppeal`, `UserOAuthIdentity`, `Session`, `MagicLinkToken`, `PasswordResetToken`, `MfaBackupCode`, `Preferences`, `Device`, `LoginCode`                                        |
| Trip            | `Trip`, `ItineraryDay`, `ItineraryItem`, `TripVersion`, `TripWatch`, `TripPublication`                                                                                                    |
| PlaceDiscovery  | `Place`, `PlaceTag`, `PlaceEmbedding`, `Stay`, `StayPrice`, `StayBooking`, `Eatery`, `Dish`, `DishTag`, `RouteLeg`, `TransitSchedule`, `WeatherForecast`, `Alert`, `Event`, `EventSource` |
| Safety          | `CrimeIncident`, `ScamReport`, `Agent`, `SosEvent`, `TrustedContact`, `AgentRun`, `AgentStep`                                                                                             |
| LiveAndDiary    | `Geofence`, `LiveEvent`, `DiaryEntry`                                                                                                                                                     |
| SocialAndMemory | `TripShare`, `Vote`, `Expense`, `Review`, `UserKarma`, `HelpfulVote`, `Follow`, `UserBlock`, `TripComment`, `GamificationProfile`, `EarnedBadge`, `MediaAsset`, `MemoryBook`              |
| Money           | `Subscription`, `EscrowHold`, `Commission`                                                                                                                                                |
| Platform        | `NotificationPreference`, `PushSubscription`, `NotificationLog`, `AdminUser`, `ModerationItem`, `FeatureFlag`, `AdminAuditLog`                                                            |

Maps 1-to-N onto the 17 bounded contexts in [`context-map.md`](./context-map.md) — see "Cluster legend" in [`c4/components-api.md`](./c4/components-api.md) for the mapping.

## Identity

Auth + sessions + preferences + the OAuth / magic-link / password-reset tokens. User is the only model with soft-delete (GDPR erasure cascade is fan-out from Identity.UserDeleted).

```mermaid
erDiagram
    USER {
        string id PK
        string emailHash UK
        bytes emailEncrypted
        string passwordHash "optional"
        string phoneHash UK "optional"
        bytes phoneEncrypted "optional"
    }
    BANAPPEAL {
        string id PK
        string userId
        string emailHash
        string body
        string status
        datetime createdAt
    }
    USEROAUTHIDENTITY {
        string id PK
        string userId
        string provider
        string providerUserId
        string providerEmail "optional"
        datetime linkedAt
    }
    SESSION {
        string id PK
        string userId
        string refreshTokenH UK
        string deviceId "optional"
        string userAgent "optional"
        string ipHash "optional"
    }
    MAGICLINKTOKEN {
        string id PK
        string emailHash
        string tokenHash UK
        datetime expiresAt
        datetime consumedAt "optional"
        datetime createdAt
    }
    PASSWORDRESETTOKEN {
        string id PK
        string emailHash
        string tokenHash UK
        datetime expiresAt
        datetime consumedAt "optional"
        datetime createdAt
    }
    MFABACKUPCODE {
        string id PK
        string userId
        string codeHash
        datetime usedAt "optional"
        datetime createdAt
    }
    PREFERENCES {
        string id PK
        string userId UK
        string diet "list"
        string accessibility "list"
        string travelType "list"
        int budgetTier
    }
    DEVICE {
        string id PK
        string userId
        string platform
        string pushToken "optional"
        string fingerprint
        datetime lastSeenAt
    }
    LOGINCODE {
        string id PK
        string channel
        string destHash
        string codeHash
        int attempts
        datetime expiresAt
    }
    USER }o--o{ PREFERENCES : "preferences"
    USER }o--o{ SESSION : "sessions"
    USER }o--o{ MFABACKUPCODE : "mfaBackupCodes"
    USER }o--o{ DEVICE : "devices"
    USER }o--o{ USEROAUTHIDENTITY : "oauthIdentities"
    USER }o--o{ BANAPPEAL : "banAppeals"
    SESSION }o--o{ DEVICE : "device"
```

## Trip

The itinerary aggregate — Trip owns days, items, immutable versions, and the publish-state shadow (TripWatch, TripPublication).

```mermaid
erDiagram
    TRIP {
        string id PK
        string userId
        string title
        tripstatus status
        unsupported center
        float radiusKm
    }
    ITINERARYDAY {
        string id PK
        string tripId
        int dayIndex
        datetime date
        string summary "optional"
        datetime createdAt
    }
    ITINERARYITEM {
        string id PK
        string dayId
        int position
        string placeId "optional"
        datetime startTime "optional"
        datetime endTime "optional"
    }
    TRIPVERSION {
        string id PK
        string tripId
        int versionNo
        string authorId
        json snapshot
        json diff "optional"
    }
    TRIPWATCH {
        string id PK
        string tripId
        string agentRunId
        string subscribedSignals "list"
        json thresholds "optional"
        boolean active
    }
    TRIPPUBLICATION {
        string id PK
        string tripId UK
        string authorId
        string memoryBookId "optional"
        visibility visibility
        float exposedLat "optional"
    }
    TRIP }o--o{ ITINERARYDAY : "days"
    TRIP }o--o{ TRIPVERSION : "versions"
    ITINERARYDAY }o--o{ ITINERARYITEM : "items"
```

## PlaceDiscovery

Catalog + decoration of places. Stays / Food / Transport / Weather / Events all hang off Place via geo or context-map ports.

```mermaid
erDiagram
    PLACE {
        string id PK
        string sourceKey UK
        string name
        string category
        unsupported coordinates
        string address "optional"
    }
    PLACETAG {
        string id PK
        string placeId
        string key
        string value
    }
    PLACEEMBEDDING {
        string placeId PK
        string model
        unsupported embedding
        datetime updatedAt
    }
    STAY {
        string id PK
        string placeId "optional"
        string name
        float starRating "optional"
        string amenities "list"
        int wifiSpeedMbps "optional"
    }
    STAYPRICE {
        string id PK
        string stayId
        string provider
        decimal priceUsd
        string currency
        datetime checkIn
    }
    STAYBOOKING {
        string id PK
        string userId
        string stayId
        string provider
        string providerBookingId
        datetime checkIn
    }
    EATERY {
        string id PK
        string placeId "optional"
        string name
        string cuisineTags "list"
        int priceTier
        unsupported coordinates
    }
    DISH {
        string id PK
        string eateryId
        string name
        decimal priceUsd "optional"
        string photoUrl "optional"
        string caption "optional"
    }
    DISHTAG {
        string id PK
        string dishId
        string key
        string value
    }
    ROUTELEG {
        string id PK
        unsupported origin
        unsupported destination
        transportmode mode
        int distanceMeters
        int durationSec
    }
    TRANSITSCHEDULE {
        string id PK
        string routeName
        transportmode mode
        string operator "optional"
        datetime validFrom
        datetime validTo "optional"
    }
    WEATHERFORECAST {
        string id PK
        string placeId "optional"
        unsupported coordinates
        datetime forecastFor
        string source
        json payload
    }
    ALERT {
        string id PK
        string source
        scamseverity severity
        string title
        string body
        unsupported coordinates
    }
    EVENT {
        string id PK
        string sourceKey UK
        string placeId "optional"
        string title
        string description "optional"
        datetime startsAt
    }
    EVENTSOURCE {
        string id PK
        string name UK
        string baseUrl
        boolean robotsOk
        boolean enabled
        datetime createdAt
    }
    PLACE }o--o{ PLACETAG : "tags"
    PLACE }o--o{ PLACEEMBEDDING : "embedding"
    PLACE }o--o{ EATERY : "eateries"
    PLACE }o--o{ STAY : "stays"
    PLACE }o--o{ WEATHERFORECAST : "weather"
    PLACE }o--o{ EVENT : "events"
    STAY }o--o{ STAYPRICE : "prices"
    STAY }o--o{ STAYBOOKING : "bookings"
    EATERY }o--o{ DISH : "dishes"
    DISH }o--o{ DISHTAG : "tags"
    EVENT }o--o{ EVENTSOURCE : "source"
```

## Safety

Crime + scam DB, the agent verification flow, SOS lifecycle, and the AgentRun / AgentStep audit trail for AI-assisted ops.

```mermaid
erDiagram
    CRIMEINCIDENT {
        string id PK
        string source
        string category
        scamseverity severity
        unsupported coordinates
        datetime reportedAt
    }
    SCAMREPORT {
        string id PK
        string reporterId
        string category
        scamseverity severity
        unsupported coordinates
        string description
    }
    AGENT {
        string id PK
        string userId UK
        string displayName
        string bio "optional"
        agentkycstatus kycStatus
        string kycProviderRef "optional"
    }
    SOSEVENT {
        string id PK
        string userId
        unsupported coordinates
        string trigger
        datetime resolvedAt "optional"
        string resolutionNote "optional"
    }
    TRUSTEDCONTACT {
        string id PK
        string userId
        string name
        string phone "optional"
        string email "optional"
        datetime createdAt
    }
    AGENTRUN {
        string id PK
        string tripId
        agentrunstatus status
        int planVersion
        datetime createdAt
        datetime updatedAt
    }
    AGENTSTEP {
        string id PK
        string agentRunId
        string kind
        json detail "optional"
        datetime createdAt
    }
```

## LiveAndDiary

What runs DURING a trip — geofences fire LiveEvents, which feed the LLM-driven diary writer.

```mermaid
erDiagram
    GEOFENCE {
        string id PK
        string placeId "optional"
        unsupported center
        int radiusMeters
        string label
        datetime activeFrom
    }
    LIVEEVENT {
        string id PK
        string userId
        string tripId "optional"
        string geofenceId "optional"
        liveeventkind kind
        json payload "optional"
    }
    DIARYENTRY {
        string id PK
        string userId
        string tripId "optional"
        string title
        string body
        string mood "optional"
    }
    GEOFENCE }o--o{ LIVEEVENT : "liveEvents"
```

## SocialAndMemory

Sharing, voting, reviews, expenses, follow graph, gamification, and the memory-book composer (media + final PDF).

```mermaid
erDiagram
    TRIPSHARE {
        string id PK
        string tripId
        string ownerId
        string shareCode UK
        boolean publicRead
        datetime expiresAt "optional"
    }
    VOTE {
        string id PK
        string tripId
        string userId
        string targetType
        string targetId
        int value
    }
    EXPENSE {
        string id PK
        string tripId
        string paidById
        decimal amountUsd
        string currency
        string note "optional"
    }
    REVIEW {
        string id PK
        string authorId
        string tripId "optional"
        string targetType
        string targetId
        int rating
    }
    USERKARMA {
        string id PK
        string userId UK
        int score
        int reviewCount
        int helpfulVotesReceived
        string badges "list"
    }
    HELPFULVOTE {
        string id PK
        string reviewId
        string voterId
        datetime createdAt
    }
    FOLLOW {
        string followerId
        string followeeId
        datetime createdAt
    }
    USERBLOCK {
        string blockerId
        string blockedId
        datetime createdAt
    }
    TRIPCOMMENT {
        string id PK
        string tripId
        string authorId
        string body
        datetime createdAt
        datetime updatedAt
    }
    GAMIFICATIONPROFILE {
        string userId PK
        int totalPoints
        int currentStreak
        int longestStreak
        int entryCount
        int aiAssistCount
    }
    EARNEDBADGE {
        string id PK
        string userId
        string badgeKey
        datetime awardedAt
    }
    MEDIAASSET {
        string id PK
        string ownerId
        string tripId "optional"
        string memoryBookId "optional"
        string kind
        mediastatus status
    }
    MEMORYBOOK {
        string id PK
        string ownerId
        string title
        string coverS3Key "optional"
        string theme
        datetime publishedAt "optional"
    }
    REVIEW }o--o{ HELPFULVOTE : "helpfulVotes"
    MEDIAASSET }o--o{ MEMORYBOOK : "memoryBook"
```

## Money

Subscriptions + agent escrow + commission ledger. Stripe is the source of truth; rows here mirror the webhook events.

```mermaid
erDiagram
    SUBSCRIPTION {
        string id PK
        string userId
        string stripeCustomerId
        string stripeSubscriptionId UK
        subscriptionstatus status
        int priceCents
    }
    ESCROWHOLD {
        string id PK
        string userId
        string agentId
        decimal amountUsd
        string currency
        string stripePaymentIntent UK
    }
    COMMISSION {
        string id PK
        string userId
        string sourceType
        string sourceId
        decimal amountUsd
        string currency
    }
```

## Platform

Notifications (prefs + log), admin tooling (users + moderation queue + flags + audit log).

```mermaid
erDiagram
    NOTIFICATIONPREFERENCE {
        string id PK
        string userId UK
        boolean push
        boolean email
        boolean sms
        json quietHours "optional"
    }
    PUSHSUBSCRIPTION {
        string id PK
        string userId
        string endpoint UK
        string p256dh
        string auth
        datetime createdAt
    }
    NOTIFICATIONLOG {
        string id PK
        string userId
        notificationchannel channel
        string templateId
        notificationdeliverystatus status
        string providerMessageId "optional"
    }
    ADMINUSER {
        string id PK
        string email UK
        string passwordHash
        userrole role
        boolean mfaEnabled
        string mfaSecret "optional"
    }
    MODERATIONITEM {
        string id PK
        string targetType
        string targetId
        string reason
        moderationstatus status
        string actorId "optional"
    }
    FEATUREFLAG {
        string id PK
        string name UK
        string description
        boolean enabled
        json rollout "optional"
        datetime createdAt
    }
    ADMINAUDITLOG {
        string id PK
        string actorId "optional"
        string targetType
        string targetId
        string action
        json context "optional"
    }
```

## Cross-cluster relations

These are the foreign keys that cross bounded-context lines — the seams to watch when you refactor a module.

| From cluster   | From model      | →   | To model                 | To cluster      | Field               |
| -------------- | --------------- | --- | ------------------------ | --------------- | ------------------- |
| Identity       | `User`          | →   | `Trip`                   | Trip            | `trips`             |
| Identity       | `User`          | →   | `TripVersion`            | Trip            | `tripVersions`      |
| Identity       | `User`          | →   | `TripShare`              | SocialAndMemory | `tripShares`        |
| Identity       | `User`          | →   | `Vote`                   | SocialAndMemory | `votes`             |
| Identity       | `User`          | →   | `Expense`                | SocialAndMemory | `expenses`          |
| Identity       | `User`          | →   | `Review`                 | SocialAndMemory | `reviews`           |
| Identity       | `User`          | →   | `MediaAsset`             | SocialAndMemory | `mediaAssets`       |
| Identity       | `User`          | →   | `MemoryBook`             | SocialAndMemory | `memoryBooks`       |
| Identity       | `User`          | →   | `Subscription`           | Money           | `subscriptions`     |
| Identity       | `User`          | →   | `EscrowHold`             | Money           | `escrowHolds`       |
| Identity       | `User`          | →   | `Commission`             | Money           | `commissions`       |
| Identity       | `User`          | →   | `ScamReport`             | Safety          | `scamReports`       |
| Identity       | `User`          | →   | `SosEvent`               | Safety          | `sosEvents`         |
| Identity       | `User`          | →   | `TrustedContact`         | Safety          | `trustedContacts`   |
| Identity       | `User`          | →   | `StayBooking`            | PlaceDiscovery  | `stayBookings`      |
| Identity       | `User`          | →   | `NotificationPreference` | Platform        | `notificationPrefs` |
| Identity       | `User`          | →   | `NotificationLog`        | Platform        | `notificationLogs`  |
| Identity       | `User`          | →   | `PushSubscription`       | Platform        | `pushSubscriptions` |
| Identity       | `User`          | →   | `LiveEvent`              | LiveAndDiary    | `liveEvents`        |
| Identity       | `User`          | →   | `Agent`                  | Safety          | `agent`             |
| Identity       | `User`          | →   | `Dish`                   | PlaceDiscovery  | `dishReports`       |
| Identity       | `User`          | →   | `ModerationItem`         | Platform        | `moderationActions` |
| Identity       | `User`          | →   | `AdminAuditLog`          | Platform        | `adminAuditLogs`    |
| Identity       | `User`          | →   | `UserKarma`              | SocialAndMemory | `karma`             |
| Identity       | `User`          | →   | `HelpfulVote`            | SocialAndMemory | `helpfulVotes`      |
| PlaceDiscovery | `Place`         | →   | `Geofence`               | LiveAndDiary    | `geofences`         |
| Safety         | `Agent`         | →   | `EscrowHold`             | Money           | `escrowHolds`       |
| Trip           | `ItineraryItem` | →   | `Place`                  | PlaceDiscovery  | `place`             |
| Trip           | `Trip`          | →   | `TripShare`              | SocialAndMemory | `shares`            |
| Trip           | `Trip`          | →   | `Vote`                   | SocialAndMemory | `votes`             |
| Trip           | `Trip`          | →   | `Expense`                | SocialAndMemory | `expenses`          |
| Trip           | `Trip`          | →   | `Review`                 | SocialAndMemory | `reviews`           |
| Trip           | `Trip`          | →   | `MediaAsset`             | SocialAndMemory | `media`             |
| Trip           | `Trip`          | →   | `LiveEvent`              | LiveAndDiary    | `liveEvents`        |

## Enums

14 enums in [`schema.prisma`](../../apps/api/prisma/schema.prisma): `AgentKycStatus` · `AgentRunStatus` · `EscrowState` · `LiveEventKind` · `MediaStatus` · `ModerationStatus` · `NotificationChannel` · `NotificationDeliveryStatus` · `ScamSeverity` · `SubscriptionStatus` · `TransportMode` · `TripStatus` · `UserRole` · `Visibility`.

## Regenerate

```sh
pnpm docs:erd          # writes this file
pnpm docs:erd:check    # CI drift gate: exits non-zero if regen would change anything
```

## See also

- [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) — the source of truth
- [`context-map.md`](./context-map.md) — what each module owns + the event surface
- [`c4/components-api.md`](./c4/components-api.md) — visual placement of these clusters
- [`docs/runbooks/supabase-deploy.md`](../runbooks/supabase-deploy.md) — how migrations land in prod
