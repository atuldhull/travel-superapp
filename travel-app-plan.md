# Travel Super-App — Production-Grade Master Plan (v2)

> Senior-architect revision. Stack aligned to enterprise spec: NestJS + Next.js + React Native + Prisma/Postgres + Redis + Docker + GitHub Actions. Modular monolith → selective microservices. Clean / hexagonal architecture.

---

## 0. Context

Mobile-first, AI-powered travel super-app: place + radius → full itinerary (places, stays, food, events, transport fit, weather, crowd, safety, prices, translation, 3D, live re-plan). Must ship at enterprise quality: scalable, secure, observable, testable. Target: thousands of users at launch, architected for millions.

---

## 1. Best Approach Right Now (TL;DR)

**Start as a modular monolith in a Turborepo monorepo — extract microservices only where the math justifies it.** Specifically:

- **Core API = NestJS modular monolith.** One deployable, many bounded-context modules. Clear module boundaries = future microservice extraction is a refactor, not a rewrite.
- **Extract to separate services only these** (each has different scaling / language / latency profile):
  1. **ai-service** (Python FastAPI sidecar) — runs NLLB, Whisper, DistilBERT, crowd ML. Node is wrong tool for these models.
  2. **media-service** (Node worker) — image/video processing, 3D tile caching. CPU-bound, scale independent.
  3. **notification-worker** — push fan-out, SMS, email. Queue-driven.
  4. **crawler-worker** — price aggregation, events scraping. Scheduled jobs.
- **Everything else lives in the NestJS monolith** for v1: identity, trips, places, stays, safety, weather proxy, social, payments, admin.
- **Frontends:** Next.js 15 (App Router, RSC, Edge) for web/marketing/planner-desktop + admin; React Native + Expo for iOS/Android.
- **Event backbone:** Redis Streams for v1 (sufficient up to ~50k events/s, zero new infra). Migrate to Kafka/Redpanda only when warranted.

**Why this is the right call:** microservices-first for a pre-PMF product is the #1 way founders burn 6 months on infra instead of shipping. A well-modularized monolith with clean boundaries gets you to 100k users comfortably and preserves every future option.

---

## 2. Idea Rating & Honest Assessment

**8.5/10.** Defensible concept, real moat (local safety + scam + crowd data), multiple monetization paths. Biggest risk is scope — we mitigate with strict phase gates below.

| Dimension | Score | Note |
|---|---|---|
| Problem-market fit | 9 | Every segment underserved (solo, group, safety, budget). |
| Differentiation | 9 | No single app stacks safety + crowd + 3D + live re-plan + scam. |
| Feasibility (full v1) | 6 | 3D, satellite crowd, price aggregation each non-trivial. |
| Monetization | 8 | Affiliate + freemium + sponsored + B2B. |
| Defensibility | 8 | Moat = local data graph, not tech. |

---

## 3. Domain Decomposition — The "Optimum Parts"

Bounded contexts, each a NestJS module with its own controllers, services, repositories, Prisma models, and event emitters. Cross-context communication only via domain events or explicit facade interfaces (no direct service imports across contexts).

### 3.1 Core Contexts (NestJS modules in the monolith)

| # | Bounded Context | Responsibility | Key entities |
|---|---|---|---|
| 1 | **Identity** | Auth, sessions, MFA, OAuth2, profile, preferences (diet, accessibility, travel type, budget tier) | User, Session, Preferences, Device |
| 2 | **Trip Planning** | Itinerary CRUD, AI generation orchestration, drafts, versioning, share codes | Trip, ItineraryDay, ItineraryItem, TripVersion |
| 3 | **Places Catalog** | Federated place search (Google + FSQ + OSM), dedup, enrichment, embeddings, relaxation score | Place, PlaceTag, PlaceEmbedding |
| 4 | **Stays** | Hotel/homestay search, price aggregation, booking affiliate deeplinks | Stay, StayPrice, StayBooking |
| 5 | **Food & Tryouts** | Local dishes, restaurants, street-food curation | Eatery, Dish, DishTag |
| 6 | **Transport & Routing** | Mode-fit analysis (public/2W/4W/walk), ETA, transit schedules, ride-hail deeplinks | RouteLeg, TransitSchedule |
| 7 | **Safety** | Crime layer, time-of-day score, scam database, agent marketplace (KYC + escrow), SOS | CrimeIncident, ScamReport, Agent, SosEvent |
| 8 | **Weather & Environment** | Weather/UV/AQI/storm alerts (Open-Meteo proxy + caching) | WeatherForecast, Alert |
| 9 | **Events & Culture** | Local events, parties, traditional activities | Event, EventSource |
| 10 | **Translation** | Text / voice / camera OCR translation API (thin proxy to ai-service) | (stateless; cached phrases only) |
| 11 | **Live Companion** | Geofencing, arrival triggers, live re-plan, quiet-hours notification engine | Geofence, LiveEvent |
| 12 | **Social & Groups** | Shared trips, votes, expense split, public templates, reviews | TripShare, Vote, Expense, Review |
| 13 | **Media & Memory** | Photo upload, auto-organize by day/location, memory book | MediaAsset, MemoryBook |
| 14 | **Payments** | Stripe integration, subscriptions, marketplace escrow, affiliate tracking | Subscription, EscrowHold, Commission |
| 15 | **Notifications** | Push (Expo/FCM/APNs), email (Resend), SMS (Twilio), DND-aware fan-out | NotificationPreference, NotificationLog |
| 16 | **Analytics & Telemetry** | PostHog + OpenTelemetry bridge, product metrics | (events only; no persistence here) |
| 17 | **Admin & Ops** | Internal dashboard, moderation queue, agent KYC, feature flags | AdminUser, ModerationItem, FeatureFlag |

### 3.2 Extracted Services (separate deployables)

| Service | Stack | Purpose |
|---|---|---|
| **ai-service** | Python 3.12, FastAPI, Ray Serve | NLLB-200 translation, Whisper STT, DistilBERT fake-review, crowd prediction ML, embedding generation. Exposes gRPC + REST. |
| **media-service** | Node, Sharp, ffmpeg | Image resize/EXIF strip/AVIF/WebP, video transcode, 3D tile caching. |
| **notification-worker** | NestJS standalone + BullMQ | Consumes queue, fans out to FCM/APNs/Email/SMS with retries + DLQ. |
| **crawler-worker** | NestJS standalone + Playwright + cron | Price aggregation, events scraping, OSM diffs. |

### 3.3 Cross-Cutting Concerns (shared infra packages)

`@app/logger`, `@app/config`, `@app/auth`, `@app/errors`, `@app/observability`, `@app/events`, `@app/cache`, `@app/ratelimit`, `@app/validation`, `@app/testing`.

---

## 4. Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐    │
│  │ Next.js 15 Web   │   │ RN + Expo Mobile │   │ Admin (Next.js) │    │
│  │ App Router, RSC  │   │ iOS / Android    │   │ RBAC + audit    │    │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘    │
└───────────┼──────────────────────┼──────────────────────┼─────────────┘
            │ HTTPS/WSS (tRPC or REST + OpenAPI)          │
┌───────────▼──────────────────────▼──────────────────────▼─────────────┐
│  EDGE / CDN   Cloudflare  (WAF, DDoS, cache, image resizing)          │
└───────────┬───────────────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────────────┐
│  API GATEWAY  (NestJS Gateway module)                                 │
│  - Helmet, CORS, rate-limit (Redis), JWT/OAuth2 guards                │
│  - OpenAPI (Swagger) + tRPC for web                                   │
│  - Request logging + trace propagation (OpenTelemetry)                │
└───────────┬───────────────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────────────┐
│  NESTJS MODULAR MONOLITH  (clean architecture per module)             │
│  Identity · Trip · Places · Stays · Food · Transport · Safety ·       │
│  Weather · Events · Translation · Live · Social · Media · Payments ·  │
│  Notifications · Analytics · Admin                                    │
│                                                                       │
│  Each module:  Controller → UseCase → DomainService → Repository      │
│                (HTTP)        (app)      (domain)       (infra)        │
└───┬────────────────┬──────────────────┬────────────────┬──────────────┘
    │                │                  │                │
    ▼                ▼                  ▼                ▼
┌────────┐    ┌──────────────┐   ┌────────────┐   ┌─────────────┐
│Postgres│    │ Redis        │   │ Redis      │   │ S3 / R2     │
│Prisma  │    │ Cache        │   │ Streams    │   │ Media       │
│PostGIS │    │ Rate limits  │   │ Events+BullMQ │ │ 3D cache    │
│pgvector│    │ Sessions     │   │ Queues     │   │             │
└────────┘    └──────────────┘   └──────┬─────┘   └─────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────┐
        ▼                               ▼                           ▼
┌──────────────────┐          ┌──────────────────┐       ┌────────────────────┐
│ ai-service       │          │ media-service    │       │ notification-worker│
│ Python FastAPI   │          │ Node Sharp       │       │ NestJS + BullMQ    │
│ NLLB·Whisper·ML  │          │ ffmpeg · 3D      │       │ Push·Email·SMS     │
└──────────────────┘          └──────────────────┘       └────────────────────┘
                                        │
                                        ▼
                              ┌────────────────────┐
                              │ crawler-worker     │
                              │ Playwright + cron  │
                              └────────────────────┘

Observability: OpenTelemetry → Grafana Cloud (free tier) · Sentry · PostHog
Secrets: Doppler or AWS Secrets Manager · never in env files in prod
```

---

## 5. Tech Stack (aligned to your spec)

| Layer | Pick | Why |
|---|---|---|
| **Web frontend** | Next.js 15 (App Router, RSC, Server Actions) | SSR/edge-ready, SEO, shared types w/ backend |
| **Mobile** | React Native + Expo (EAS, expo-router) | Cross-platform, OTA updates, same TS types |
| **Backend** | NestJS 11 (Node 22 LTS) TypeScript strict | Enterprise DI, modules, guards, interceptors — fits clean arch perfectly |
| **ORM / DB** | Prisma 5 + PostgreSQL 16 + PostGIS + pgvector | Type-safe; one DB covers relational + geo + embeddings |
| **Cache / Queue / PubSub** | Redis 7 (Upstash free) + BullMQ + Redis Streams | One dep, three jobs |
| **Messaging (future)** | Redpanda (Kafka API) | Only when event volume justifies; swap Streams → Redpanda by changing adapter |
| **AI sidecar** | Python 3.12 + FastAPI + Ray Serve | NLLB, Whisper, DistilBERT, crowd ML |
| **LLM** | Claude Sonnet 4.6 + Haiku 4.5 + Llama 3.1 via Ollama (self-host) | Quality + cost mix |
| **Vector** | pgvector (same Postgres) | Avoid extra infra until we outgrow it |
| **Search** | Meilisearch (OSS, Docker) | Place/review full-text; simpler than Elastic |
| **Maps** | Mapbox GL (web + RN) + Google 3D Tiles | Free tiers generous |
| **Places data** | Google Places + Foursquare + OSM Overpass | Federated, dedup via name+geo+embedding |
| **Weather** | Open-Meteo (no key, free) | Excellent coverage |
| **Auth** | NestJS + Passport: JWT (access 15m) + refresh (30d rotated) + OAuth2 (Google/Apple) + TOTP MFA | Standard hardened |
| **Payments** | Stripe (subs + connect for agent escrow) | Industry standard |
| **Email / SMS / Push** | Resend · Twilio · Expo Notifications/FCM/APNs | Free tiers |
| **CDN / WAF** | Cloudflare | Free tier covers launch |
| **Secrets** | Doppler (free tier) | Real rotation beats .env |
| **Observability** | OpenTelemetry + Grafana Cloud (logs/metrics/traces free tier) + Sentry + PostHog | Production-grade visibility |
| **Testing** | Jest (unit) + Supertest (API) + Testcontainers (integration) + Playwright (E2E web) + Maestro (E2E mobile) + k6 (load) | Full pyramid |
| **Docs** | OpenAPI auto-gen (Nest Swagger) + Storybook + ADRs in `/docs/adr` | |
| **CI/CD** | GitHub Actions + Turborepo remote cache + Docker Buildx + Trivy scans | Cached, parallel, secure |
| **Infra** | Docker + Docker Compose (dev) · Fly.io/Railway (v1) · Terraform-ready for AWS ECS/EKS later | Free → paid path |
| **Package manager** | pnpm + Turborepo | Monorepo speed |

---

## 6. Clean Architecture — Per-Module Layering

Every NestJS module follows the same 4-layer structure (hex/onion):

```
modules/<context>/
  domain/          Pure TS — entities, value objects, domain services, domain events.
                   No framework imports. No I/O. Unit-tested in isolation.
  application/     Use cases (command/query handlers). Orchestrates domain + ports.
                   Defines repository interfaces (ports). Depends only on domain.
  infrastructure/  Adapters: Prisma repositories, HTTP clients, queue producers,
                   external API wrappers. Implements ports from application.
  interface/       Controllers (HTTP/tRPC/WS), DTOs, validators (class-validator),
                   mappers. Thin — delegates to use cases.
  <context>.module.ts   Wires it all with Nest DI.
```

**Dependency rule:** domain ← application ← infrastructure/interface. Never the other way. Enforced via ESLint `import/no-restricted-paths` and Nx/Turborepo boundary lint.

---

## 7. Monorepo Folder Structure

```
travel-superapp/
├── apps/
│   ├── api/                        NestJS modular monolith
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/
│   │   │   │   ├── trip/
│   │   │   │   ├── places/
│   │   │   │   ├── stays/
│   │   │   │   ├── food/
│   │   │   │   ├── transport/
│   │   │   │   ├── safety/
│   │   │   │   ├── weather/
│   │   │   │   ├── events/
│   │   │   │   ├── translation/
│   │   │   │   ├── live/
│   │   │   │   ├── social/
│   │   │   │   ├── media/
│   │   │   │   ├── payments/
│   │   │   │   ├── notifications/
│   │   │   │   ├── analytics/
│   │   │   │   └── admin/
│   │   │   ├── common/             guards, interceptors, filters, pipes
│   │   │   ├── config/             typed config (zod-validated)
│   │   │   └── main.ts
│   │   ├── prisma/                 schema.prisma, migrations, seeds
│   │   ├── test/
│   │   └── Dockerfile
│   ├── web/                        Next.js 15 (user-facing)
│   ├── admin/                      Next.js 15 (internal)
│   ├── mobile/                     React Native + Expo
│   ├── ai-service/                 Python FastAPI
│   ├── media-service/              Node worker
│   ├── notification-worker/        NestJS standalone + BullMQ
│   └── crawler-worker/             NestJS standalone + Playwright
├── packages/
│   ├── shared-types/               Zod schemas + TS types (FE ↔ BE single source of truth)
│   ├── ui/                         shadcn + Tailwind design system (web)
│   ├── mobile-ui/                  RN design system (Tamagui)
│   ├── sdk/                        Auto-generated API client from OpenAPI
│   ├── logger/
│   ├── config/
│   ├── errors/
│   ├── observability/
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   ├── docker-compose.yml          local dev (pg, redis, meilisearch, minio, mailpit)
│   ├── docker-compose.prod.yml
│   ├── k8s/                        optional Helm charts (explained, not required v1)
│   └── terraform/                  AWS skeleton for later
├── .github/
│   └── workflows/                  ci.yml, cd.yml, security.yml, preview.yml
├── docs/
│   ├── adr/                        architecture decision records
│   ├── api/                        OpenAPI snapshots
│   ├── runbooks/                   oncall guides
│   └── onboarding.md
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 8. Key Code Patterns (representative, not exhaustive)

### 8.1 Typed, validated config (Nest + Zod)
```ts
// packages/config/src/schema.ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLAUDE_API_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  // ...
});
export type Env = z.infer<typeof EnvSchema>;
```

### 8.2 Use-case pattern (application layer)
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

### 8.3 Guards: JWT + RBAC
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'premium')
@Controller('trips')
export class TripController { /* ... */ }
```

### 8.4 Rate limiting (Redis sliding window)
```ts
@UseGuards(ThrottlerGuard)
@Throttle({ ai: { limit: 10, ttl: 60_000 } })   // 10 AI calls / min / user
```

### 8.5 Prisma schema highlight
```prisma
model Trip {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id])
  center        Unsupported("geography(Point, 4326)")
  radiusKm      Float
  days          ItineraryDay[]
  version       Int            @default(1)
  createdAt     DateTime       @default(now())
  @@index([userId, createdAt])
  @@index([center], type: Gist)
}

model PlaceEmbedding {
  placeId   String   @id
  embedding Unsupported("vector(1024)")
  @@index([embedding], type: Ivfflat)
}
```

### 8.6 Error handling (centralized)
```ts
// common/filters/domain-exception.filter.ts
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost) {
    // Map domain codes → HTTP, log with trace id, scrub PII
  }
}
```

### 8.7 Structured logging (Pino + trace correlation)
```ts
logger.info({ userId, tripId, traceId }, 'itinerary_generated');
```

---

## 9. Security (non-negotiables)

| Concern | Control |
|---|---|
| Input validation | `class-validator` DTOs + Zod at service boundaries; reject unknowns |
| SQL injection | Prisma parameterized queries only; no raw SQL w/o review |
| XSS | React escapes; CSP headers via Helmet; sanitize user HTML (DOMPurify) |
| CSRF | SameSite=strict cookies; double-submit token on state-changing routes |
| Auth | JWT access 15m + rotating refresh 30d in httpOnly SameSite cookie; Argon2id password hash; MFA (TOTP) for premium + agents |
| Authorization | CASL-based policy layer; deny-by-default; per-resource ownership checks |
| Secrets | Doppler; rotation; never in images; scanned by gitleaks in CI |
| Transport | TLS 1.3 everywhere; HSTS preload; mTLS between internal services in prod |
| Rate limiting | Redis sliding window per IP + per user + per endpoint class (esp. AI) |
| PII | Field-level encryption for phone/email; pgcrypto; DPIA documented |
| Compliance | GDPR + India DPDP + COPPA-aware; data export + delete APIs day one |
| Dependency security | `pnpm audit` + Snyk/Trivy in CI; Dependabot weekly |
| Container security | Distroless base images; non-root; Trivy image scan; SBOM (CycloneDX) |
| OWASP Mobile Top 10 | Cert pinning, secure storage (Keychain/Keystore), root/jailbreak detect for premium flows |

---

## 10. Testing Strategy

```
          /\
         /E2E\          Maestro (mobile) + Playwright (web) — golden paths only
        /------\
       /  API   \       Supertest against real Nest app + Testcontainers Postgres
      /----------\
     / Integration\     Module + adapter tests with real Redis/Postgres (dockerized)
    /--------------\
   /     Unit       \   Jest; pure domain + use-case tests (mocked ports)
  /------------------\
```

- **≥ 80% line coverage** on `domain/` and `application/`; ≥ 60% overall.
- **Contract tests** (Pact) between api and mobile/web SDKs.
- **Property-based tests** (fast-check) for pricing, scoring, geo math.
- **Load tests** (k6) in CI on nightly against staging; SLO: p95 < 300ms for reads, < 800ms for AI endpoints (excluding LLM time).
- **Chaos tests** (Toxiproxy) monthly — DB/Redis latency injection.

Example test:
```ts
// generate-itinerary.use-case.spec.ts
it('fails when radius exceeds 500km', async () => {
  const uc = new GenerateItineraryUseCase(places, ai, repo, events);
  await expect(uc.execute({ ...cmd, radiusKm: 501 }))
    .rejects.toThrow(InvalidRadiusError);
  expect(ai.planItinerary).not.toHaveBeenCalled();
});
```

---

## 11. Error Handling & Observability

- **Error model:** `DomainError` base with `code`, `httpStatus`, `context`. Mapped in global filter. Clients get `{ code, message, traceId, details }`.
- **Logging:** Pino JSON logs → stdout → Grafana Loki. Trace id on every log.
- **Metrics:** Prom-client exposes `/metrics`. RED metrics per endpoint + domain counters (trips_generated, sos_triggered, bookings_converted).
- **Tracing:** OpenTelemetry SDK auto-instruments Nest, Prisma, Redis, HTTP clients → Grafana Tempo.
- **Alerting:** Grafana alerts on SLO breaches + Sentry for exceptions; routed to Slack + PagerDuty (premium).
- **Runbooks:** `docs/runbooks/` per top-5 incidents (db-cpu-high, redis-eviction, ai-service-down, stripe-webhook-backlog, push-delivery-failure).

---

## 12. DevOps & Deployment

### 12.1 Local dev (one command)
```bash
pnpm i && docker compose up -d && pnpm db:migrate && pnpm dev
```
`docker-compose.yml` runs: Postgres+PostGIS+pgvector, Redis, Meilisearch, MinIO (S3), Mailpit (email), Jaeger (tracing).

### 12.2 Dockerfile (multi-stage, distroless)
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && pnpm fetch
COPY . .
RUN pnpm install --offline && pnpm build --filter=api

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER nonroot
CMD ["dist/main.js"]
```

### 12.3 GitHub Actions (parallelized, cached)
- `ci.yml`: lint → typecheck → unit → integration (matrix by app) → build — all parallel via Turbo
- `security.yml`: gitleaks, trivy (images + fs), pnpm audit, CodeQL
- `cd.yml`: on main → build+push images to GHCR → deploy to Fly.io (api) + Vercel (web/admin) + EAS (mobile OTA)
- `preview.yml`: every PR gets a Fly preview app + Vercel preview + Expo preview build
- `release.yml`: changesets → semantic version → GH release → mobile store submission (manual gate)

### 12.4 Environments
`local → preview (per-PR) → staging (main) → production (tagged)`. Migrations via `prisma migrate deploy` in a pre-deploy job with shadow DB diff check.

### 12.5 Kubernetes (when and why)
Skip for v1 — Fly.io/Railway handle scaling to ~100k MAU. Move to EKS/GKE when: you need >3 regions, custom networking, or dedicated GPU pools for self-hosted LLMs. Helm charts are already scaffolded in `/infra/k8s` so it's a deploy swap, not a rewrite.

---

## 13. Documentation

- **README** per app with quickstart + architecture link
- **OpenAPI** auto-generated from Nest decorators → `docs/api/openapi.yaml` → Stoplight-rendered
- **SDK** auto-generated from OpenAPI (orval) → `packages/sdk` used by web + mobile (one source of truth)
- **Storybook** for web + mobile UI
- **ADRs** in `docs/adr` (MADR format) for every significant decision
- **Onboarding doc** gets a new engineer productive in one day (verified quarterly)

---

## 14. Extensibility & Maintainability

- **Feature flags** (PostHog or OpenFeature) gate every new feature
- **Config-driven** scoring weights, pricing rules, LLM prompts — all in DB + hot-reloaded, not hardcoded
- **Strategy pattern** for swappable adapters: places data source, translator, hotel provider — add a new provider = new adapter class, register in module
- **Event-driven** cross-context integration means adding, say, a "carbon calculator" module = subscribe to `TripDraftedEvent`, no edits to Trip module
- **Versioned APIs** (`/v1/…`) from day one; deprecation headers before removal

---

## 15. Phased Roadmap (revised for this stack)

| Phase | Duration | Scope | Exit criteria |
|---|---|---|---|
| **0 — Foundation** | Weeks 1–3 | Monorepo, CI/CD, Docker, Nest skeleton, Next.js + Expo skeleton, auth module, logging, tracing, CI all green | One-command local up, green PR template, identity working end-to-end on all 3 clients |
| **1 — Core MVP** | Months 2–4 | Trip, Places, Stays, Food, Transport, Weather, Translation, Offline pack, Notifications, Payments (affiliate). Ship to stores. | 500 beta users, crash-free > 99.5%, p95 < 500ms |
| **2 — Safety & Live** | Months 5–7 | Safety (crime + scam + SOS + agents), Live (geofence + re-plan), Events, Social (groups + expenses), Freemium live | Premium conv > 3%, SOS tested in 3 cities |
| **3 — Wow Layer** | Months 8–11 | 3D previews, animated map, crowd analytics, photo templates, price aggregator, fake-review ML, memory book, public templates | MAU 50k, B2B pilot signed |
| **4 — Polish & Scale** | Month 12+ | Gamification, carbon, live guide video, fine-tune Llama, multi-region, SOC 2 readiness | Profitability path visible |

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Node bad fit for heavy ML | Python ai-service isolated; Node only orchestrates |
| LLM cost explosion | Aggressive caching of embeddings + itinerary templates; Haiku for cheap ops; fine-tune later |
| Scope creep | Strict phase gates; each phase is independently shippable |
| Data moat slow to build | Seed with OSM + licensed data for 5 launch cities; incentivize reviews with gamification |
| Local agent fraud | KYC (Sumsub/Persona) + Stripe Connect escrow + karma weighting + two-sided reviews |
| Monolith → microservice pain later | Strict module boundaries, ports/adapters, events now = pain-free extraction |
| Legal (crime data, PII, satellite ToS) | Counsel review before Phase 2; GDPR + DPDP compliant from day 1; DPIA recorded |
| Battery drain (live mode) | Geofencing > polling; adaptive update intervals; background-task allowance per OS |
| Vendor lock-in | Every external dep behind a port/adapter; ORM abstracts DB; no provider SDKs leaking into domain |

---

## 17. Immediate Next Steps (first 2 weeks)

1. Approve this plan → create GitHub org + monorepo skeleton
2. Initialize Turborepo (apps/api, web, mobile, ai-service; packages/shared-types, ui, sdk)
3. Stand up Docker Compose local stack (Postgres+PostGIS+pgvector, Redis, Meilisearch, MinIO, Mailpit)
4. Identity module end-to-end (JWT + OAuth Google/Apple + MFA) with tests + OpenAPI + SDK gen
5. CI pipeline green (lint, typecheck, unit, integration, security scans, preview deploys)
6. ADR-001 "Modular monolith with extracted ML/worker services" committed
7. Figma design system + 3 hero screens (itinerary, map, safety)
8. Pick 3–5 launch cities; start OSM data ingestion pipeline for Phase 1 seed

---

## 18. Verification Plan

- **Per PR:** lint + typecheck + unit + integration + security scans + preview deploy, all must be green
- **Per phase:** full E2E (Maestro + Playwright), load test (k6 at 10× expected RPS), security review (OWASP checklist), closed beta 50–200 users, manual trip test in a target city
- **Pre-launch:** third-party pen test (API + mobile); DPIA sign-off; store review preparation
- **Post-launch:** SLOs tracked in Grafana; weekly error-budget review; monthly chaos test

---

## 19. What I Improved Over v1

1. **Stack switched** to your spec (Node/NestJS/Next/Prisma) while preserving React Native for mobile and Python sidecar only where ML demands it.
2. **Sharp bounded-context decomposition** (17 contexts) instead of a vague module list.
3. **Clean/hex layering rule** enforced in code + lint — future microservice extraction is cheap.
4. **Modular monolith first** with explicit "when to extract" triggers — avoids premature microservices.
5. **Enterprise-grade cross-cutting**: observability, security, testing pyramid, runbooks, ADRs.
6. **Concrete CI/CD pipeline** (parallel, cached, preview-per-PR, security-scanned).
7. **Vendor-lock-in avoidance** — every external dep behind a port.
8. **Phased, shippable milestones** tied to measurable exit criteria.
