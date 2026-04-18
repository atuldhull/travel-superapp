# The Travel Super-App Playbook
### A Complete Build Handbook — from Concept to Production

> Consolidates `travel-app-plan.md`, `travel-app-compendium-v2.md`, and `travel-app-compendium-v3.md` into a single, book-organised reference. Every substantive piece of content from those three files is preserved; the structure is what changed.

---

## How to Read This Book

- **Parts I–III** establish *what* you're building and *why* — vision, architecture, implementation blueprints. Read sequentially.
- **Part IV** is the audit of your v1 Build Compendium. Read after I–III so the audit makes sense.
- **Parts V–VIII** are reference chapters — economics, execution playbook, quality/safety, ops/governance. Dip in when needed.
- **Parts IX–X** are delivery — devops, roadmap, next steps.
- **Appendices** hold the glossary, stack summary, and a mapping back to the original three files.

Treat it as a book: skim the Contents, read what's load-bearing for you now, return to it as you progress through each Phase.

---

## Contents

**Part I — Vision & Strategy**
- Chapter 1 — Context & the Problem Space
- Chapter 2 — Idea Assessment & Rating
- Chapter 3 — Feature Catalog
- Chapter 4 — Monetization Strategy
- Chapter 5 — UI/UX Direction

**Part II — Architecture**
- Chapter 6 — System Architecture
- Chapter 7 — Domain Decomposition
- Chapter 8 — Technology Stack
- Chapter 9 — Clean / Hexagonal Architecture
- Chapter 10 — Monorepo Structure

**Part III — Implementation Blueprints**
- Chapter 11 — Code Patterns & Conventions
- Chapter 12 — Data Modeling (Prisma · PostGIS · pgvector)
- Chapter 13 — Security
- Chapter 14 — Testing Strategy
- Chapter 15 — Observability & Error Handling

**Part IV — The Build Compendium**
- Chapter 16 — Feasibility Verdict
- Chapter 17 — Bugs in the v1 Compendium
- Chapter 18 — Missing Blocks
- Chapter 19 — Agent Meta-Layer (Safety Rails)
- Chapter 20 — Recommended Compendium Table of Contents

**Part V — Economics**
- Chapter 21 — Build-Time Token Economics
- Chapter 22 — Runtime LLM Economics
- Chapter 23 — Unit Economics & Break-Even

**Part VI — Execution Playbook**
- Chapter 24 — Block Lifecycle State Machine
- Chapter 25 — Parallelization & Dependency DAG
- Chapter 26 — Agent-Tool Optimization

**Part VII — Quality & Safety**
- Chapter 27 — Anti-Pattern Library
- Chapter 28 — In-App AI Prompts

**Part VIII — Operations & Governance**
- Chapter 29 — Analytics Event Taxonomy
- Chapter 30 — Data Governance & Privacy
- Chapter 31 — Disaster Recovery & Incident Response

**Part IX — DevOps**
- Chapter 32 — Local Development
- Chapter 33 — CI/CD
- Chapter 34 — Deployment

**Part X — Roadmap & Delivery**
- Chapter 35 — Phased Roadmap
- Chapter 36 — Risks & Mitigations
- Chapter 37 — Immediate Next Steps
- Chapter 38 — Verification Plan
- Chapter 39 — What To Do Next (Action Menu)

**Appendices**
- Appendix A — Glossary
- Appendix B — Reference Stack Summary
- Appendix C — Document Mapping (v1 / v2 / v3 → this book)

---

# Part I — Vision & Strategy

## Chapter 1 — Context & the Problem Space

### 1.1 What You're Building
A mobile-first, AI-powered travel super-app. A user enters a place + radius; the app generates a full itinerary (places, stays, food, events, transport fit, timing, crowd, safety, weather, prices, language, scams, 3D previews, photo spots) and stays with them through the trip with live re-planning.

### 1.2 Target
iOS + Android first, web companion for planning. Full vision v1 delivered in phases. Best-of-breed stack using free tiers and open-source where possible. Architected for thousands of users at launch, scaled-out to millions.

### 1.3 The Core Differentiator
No single existing app combines safety layer + crowd analytics + 3D previews + live re-plan + scam shield + trusted local agents. Most travel apps handle one or two of these; stacking them is the moat.

---

## Chapter 2 — Idea Assessment & Rating

### 2.1 Overall Score
**8.5 / 10** — strong, defensible concept with real moat potential. Biggest risk is scope; that's mitigated by phased delivery in Chapter 35.

### 2.2 Scorecard

| Dimension | Score | Note |
|---|---|---|
| Problem–market fit | 9/10 | Solo, group, budget, safety-conscious travelers all underserved. |
| Differentiation | 9/10 | No single app combines safety + crowd + 3D + live re-plan + scam shield. |
| Feasibility (v1 full) | 6/10 | 3D, satellite crowd, price aggregation are each individually hard. |
| Monetization | 8/10 | Multiple strong paths (affiliate, freemium, B2B licensing). |
| Defensibility | 8/10 | Moat = local data graph (scam DB, verified agents, crime, crowd), not tech. |

### 2.3 Honest Truths
- **Timeline reality:** Full vision v1 is 9–14 months for a small team. Phased delivery lets you ship a killer MVP in ~4 months and layer "wow" features in releases 2–3.
- **Moat reality:** Defensibility comes from your *data graph*, not your architecture. Launch city selection and review-seeding are more strategic than tech choices.
- **Biggest single risk:** Scope creep. Phase gates are non-negotiable.

---

## Chapter 3 — Feature Catalog

### 3.1 Planning Features (Pre-Trip)
1. Place + radius input → AI suggests top places within N km.
2. User-curated additions — add your own spots to the pool.
3. Popularity + ratings from travelers (in-app) and aggregated (Google/TripAdvisor).
4. Stay suggestions — hotels, hostels, homestays, with ratings + price.
5. Food & try-outs — local dishes, iconic restaurants, street food.
6. Transport-mode fit filter — public / 2-wheeler / 4-wheeler / walk; app flags which spots are reachable.
7. Best time to visit (time-of-day + season).
8. AI itinerary generator with drag-to-edit on an animated map.
9. Iconic photo templates so users don't miss signature shots.
10. Budget & price optimizer — aggregates trusted sources for best prices.
11. Local events, parties, traditional activities during travel window.
12. Relaxation score per place + composite itinerary score.
13. 3D experience previews of destinations (Cesium / Google 3D Tiles).

### 3.2 Live Features (On-Trip)
14. Auto-location details — arrive at a spot, get instant info.
15. Live re-plan when things go sideways (delays, closures, weather).
16. Crowd / rush analytics via satellite + popular-times data.
17. Local language translator (voice + text + camera OCR).
18. Scam alerts + verified local agents.
19. Weather / storm / rain / UV alerts.
20. Crime & safety alerts — recent incidents + time-of-day safety score.
21. Animated map UI — tap a node to edit/swap.

### 3.3 Post-Trip Features
22. Memory book (photos auto-organized by day + location).
23. Review + contribute — feeds the community data moat.

### 3.4 Features You Missed (Recommended Additions)

| # | Feature | Why it matters |
|---|---|---|
| M1 | Offline mode (maps, itinerary, translator pack) | Rural / low-signal areas are exactly where the app is most needed. |
| M2 | Group trip collaboration — shared plan, vote on activities, split expenses | Huge retention driver; most trips aren't solo. |
| M3 | Budget tracker + currency converter + live FX | Users obsess over this; cheap to build. |
| M4 | Visa / documents / vaccination checklist per destination | Converts planners into committed travelers. |
| M5 | Emergency SOS — nearest hospital, pharmacy, embassy, police, one-tap call | Huge trust signal; women-safety angle. |
| M6 | Dietary + accessibility filters (veg/halal/kosher/allergy, wheelchair, elderly) | Unlocks large underserved segments. |
| M7 | Plug type / voltage / tipping / SIM / local etiquette pack | Tiny to build, travelers love it. |
| M8 | Packing list generator (weather + activities + trip length) | Sticky pre-trip feature. |
| M9 | Fake-review / deepfake detection on listings | Differentiator vs TripAdvisor spam. |
| M10 | Carbon footprint per itinerary + greener swaps | Brand + Gen-Z appeal. |
| M11 | Gamification — badges, streaks, "places visited" map | Retention + virality. |
| M12 | Live transit — bus/metro timings, ride-hail deeplinks | Fills the "how do I actually get there" gap. |
| M13 | Women-solo / LGBTQ+ safety layer | Specialized safety data is a real moat. |
| M14 | Pet-friendly filters | Small add, loyal segment. |
| M15 | Social / inspire — public trip templates others can clone | Organic growth engine. |
| M16 | Smart notifications that respect DND + quiet hours | Prevents alert fatigue that kills the app. |
| M17 | Post-trip expense reimbursement pack (business travelers) | Unlocks B2B. |
| M18 | "Call a human guide" paid video-call with verified local | Fallback revenue + premium trust. |

---

## Chapter 4 — Monetization Strategy

A hybrid, layered approach. Avoid intrusive ads — your moat is trust, and ads kill trust.

### 4.1 Affiliate Commissions (Primary, Phase 1)
Booking.com, Amadeus, Viator. 4–15% per booking. Zero friction for users. Live from day one.

### 4.2 Freemium (Phase 2)
- **Free:** basic itinerary, 1 offline pack, 50 translator queries/day.
- **Pro ($4.99/mo or $29/yr):** unlimited offline, live re-plan, 3D previews, verified agent unlocks, ad-free, priority support.

### 4.3 Sponsored Listings (Phase 3)
Verified local agents and event organizers pay to surface. Clear "sponsored" label — don't compromise trust.

### 4.4 B2B Licensing (Phase 4)
White-label the safety + itinerary engine to corporate travel (SAP Concur competitor) and tourism boards.

---

## Chapter 5 — UI/UX Direction

### 5.1 Theme System
Light / Dark / Sunset (warm travel vibe) / Midnight (night mode for low-battery trips). User switchable.

### 5.2 Design Language
Glassmorphism + bold typography + cinematic photography. References: Airbnb + Apple Maps + Hopper.

### 5.3 Hero Surface: the Animated Map
The itinerary *is* the map, not a separate tab. Tap a pin → sheet slides up with swap/remove/info.

### 5.4 Onboarding
Three screens maximum. Ask travel type, diet, accessibility, budget tier. Skip → sensible defaults.

### 5.5 Micro-Interactions
Lottie for loading, haptic feedback on every tap, shared-element transitions (Reanimated 3).

### 5.6 Accessibility
WCAG AA minimum, dynamic type, VoiceOver/TalkBack, reduce-motion support.

### 5.7 Design Process
Figma with a proper design system (tokens, components). Handoff via Figma MCP to Claude Code.

---

# Part II — Architecture

## Chapter 6 — System Architecture

### 6.1 High-Level Diagram

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
└───┬────────────────┬──────────────────┬────────────────┬──────────────┘
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

### 6.2 Core Principle: Modular Monolith First
Start as a modular monolith in a Turborepo monorepo — extract microservices only where the math justifies it. Microservices-first for a pre-PMF product is the #1 way founders burn six months on infra instead of shipping. A well-modularized monolith with clean boundaries gets you to 100k users comfortably and preserves every future option.

### 6.3 When to Extract
Extract a service only when it has a genuinely different scaling / language / latency profile from the monolith. Chapter 7.3 lists the four services that clear that bar.

### 6.4 Event Backbone
Redis Streams for v1 (sufficient up to ~50k events/s, zero new infra). Migrate to Kafka/Redpanda only when warranted.

---

## Chapter 7 — Domain Decomposition

### 7.1 The "Optimum Parts" Principle
Bounded contexts, each a NestJS module with its own controllers, services, repositories, Prisma models, and event emitters. Cross-context communication only via domain events or explicit facade interfaces — never direct service imports across contexts.

### 7.2 Core Contexts (17 NestJS Modules)

| # | Bounded Context | Responsibility | Key entities |
|---|---|---|---|
| 1 | **Identity** | Auth, sessions, MFA, OAuth2, profile, preferences | User, Session, Preferences, Device |
| 2 | **Trip Planning** | Itinerary CRUD, AI generation, drafts, versioning, share codes | Trip, ItineraryDay, ItineraryItem, TripVersion |
| 3 | **Places Catalog** | Federated place search, dedup, enrichment, embeddings, relaxation score | Place, PlaceTag, PlaceEmbedding |
| 4 | **Stays** | Hotel/homestay search, price aggregation, booking deeplinks | Stay, StayPrice, StayBooking |
| 5 | **Food & Tryouts** | Local dishes, restaurants, street-food curation | Eatery, Dish, DishTag |
| 6 | **Transport & Routing** | Mode-fit, ETA, transit schedules, ride-hail deeplinks | RouteLeg, TransitSchedule |
| 7 | **Safety** | Crime layer, time-of-day score, scam DB, agent marketplace, SOS | CrimeIncident, ScamReport, Agent, SosEvent |
| 8 | **Weather & Environment** | Weather/UV/AQI/storm alerts (Open-Meteo proxy + cache) | WeatherForecast, Alert |
| 9 | **Events & Culture** | Local events, parties, traditional activities | Event, EventSource |
| 10 | **Translation** | Text / voice / camera OCR (thin proxy to ai-service) | (stateless; cached phrases) |
| 11 | **Live Companion** | Geofencing, arrival triggers, live re-plan, quiet-hours engine | Geofence, LiveEvent |
| 12 | **Social & Groups** | Shared trips, votes, expense split, public templates, reviews | TripShare, Vote, Expense, Review |
| 13 | **Media & Memory** | Photo upload, auto-organize by day/location, memory book | MediaAsset, MemoryBook |
| 14 | **Payments** | Stripe subs, marketplace escrow, affiliate tracking | Subscription, EscrowHold, Commission |
| 15 | **Notifications** | Push, email, SMS, DND-aware fan-out | NotificationPreference, NotificationLog |
| 16 | **Analytics & Telemetry** | PostHog + OpenTelemetry bridge, product metrics | (events only; no persistence) |
| 17 | **Admin & Ops** | Internal dashboard, moderation queue, agent KYC, feature flags | AdminUser, ModerationItem, FeatureFlag |

### 7.3 Extracted Services (4 Separate Deployables)

| Service | Stack | Purpose |
|---|---|---|
| **ai-service** | Python 3.12, FastAPI, Ray Serve | NLLB-200 translation, Whisper STT, DistilBERT fake-review, crowd prediction ML, embeddings. gRPC + REST. |
| **media-service** | Node, Sharp, ffmpeg | Image resize / EXIF strip / AVIF / WebP, video transcode, 3D tile caching. |
| **notification-worker** | NestJS standalone + BullMQ | Consumes queue, fans out to FCM/APNs/Email/SMS with retries + DLQ. |
| **crawler-worker** | NestJS standalone + Playwright + cron | Price aggregation, events scraping, OSM diffs. |

### 7.4 Cross-Cutting Concerns (Shared Packages)
`@app/logger`, `@app/config`, `@app/auth`, `@app/errors`, `@app/observability`, `@app/events`, `@app/cache`, `@app/ratelimit`, `@app/validation`, `@app/testing`.

---

## Chapter 8 — Technology Stack

### 8.1 Frontend
| Layer | Pick | Why |
|---|---|---|
| Web | Next.js 15 (App Router, RSC, Server Actions) | SSR/edge-ready, SEO, shared types with backend. |
| Mobile | React Native + Expo 51 (EAS, expo-router) | Cross-platform, OTA updates, same TS types. |
| Language | TypeScript strict end-to-end | Type safety across mobile + backend. |
| Web UI | shadcn/ui + Tailwind | Fast, accessible, composable. |
| Mobile UI | Tamagui | Single component system across web-native parity. |

### 8.2 Backend
| Layer | Pick | Why |
|---|---|---|
| Framework | NestJS 11 (Node 22 LTS) | Enterprise DI, modules, guards, interceptors. |
| Runtime adapter | Fastify | 2–3× faster than Express for this workload. |
| ORM | Prisma 5 | Type-safe; one DB covers relational + geo + embeddings. |
| AI sidecar | Python 3.12 + FastAPI + Ray Serve | NLLB, Whisper, DistilBERT, crowd ML. |
| Scheduling | BullMQ on Redis | Queues + cron in one dep. |

### 8.3 Data Layer
| Layer | Pick | Why |
|---|---|---|
| Database | PostgreSQL 16 + PostGIS + pgvector | Relational + geo + embeddings in one DB. |
| Cache | Redis 7 (Upstash free) | Rate limits, hot data, sessions, queues. |
| Messaging (v1) | Redis Streams | Sufficient up to ~50k events/s. |
| Messaging (later) | Redpanda (Kafka API) | Swap path via adapter. |
| Search | Meilisearch (OSS, Docker) | Typo-tolerant full-text; simpler than Elastic. |
| Vector | pgvector | Avoid extra infra until outgrown. |

### 8.4 AI Stack
| Task | Model | Rationale |
|---|---|---|
| Itinerary generation, re-plan | Claude Sonnet 4.6 | Multi-constraint reasoning. |
| Quick edits, summaries, chat | Claude Haiku 4.5 | 10× cheaper, fast. |
| Bulk embeddings, classification | Llama 3.1 8B via Ollama | ~$0 marginal cost (self-host). |
| Translation | NLLB-200 (self-host) | Offline-capable, 200 languages. |
| Voice | Whisper (on-device small) | Offline translator input. |
| Fake-review detection | DistilBERT fine-tuned | Cheap inference, trainable on your data. |
| Crowd prediction | Prophet / LightGBM on satellite + popular-times | Unique IP. |

### 8.5 External APIs (Free-Tier Friendly)
| Category | Primary | Secondary | Why |
|---|---|---|---|
| Maps | Mapbox (50k free loads/mo) | Google Maps | Mapbox: better custom; Google: 3D. |
| Places | Google Places | Foursquare + OSM Overpass | Federate, dedup by name + geo + embedding. |
| Hotels | Booking.com Affiliate | Amadeus Self-Service | Both have free tiers + commission revenue. |
| Weather | Open-Meteo (no key, free) | OpenWeatherMap | Open-Meteo is criminally good. |
| UV / Air | Open-Meteo | WAQI | Both free. |
| Satellite / crowd | Sentinel Hub (ESA free) | Google Popular Times via SerpAPI | For crowd heatmaps. |
| Crime | Numbeo API | Government open data | Supplement with user reports. |
| Payments | Stripe (+ Connect for escrow) | — | Industry standard. |
| Email / SMS / Push | Resend · Twilio · Expo Notifications/FCM/APNs | — | Free tiers. |

### 8.6 DevOps & Infra
| Concern | Pick | Why |
|---|---|---|
| Package manager | pnpm + Turborepo | Monorepo speed, remote cache. |
| Auth library | NestJS + Passport (JWT + refresh + OAuth2 + TOTP MFA) | Hardened standard. |
| CDN / WAF | Cloudflare | Free tier covers launch. |
| Secrets | Doppler (free tier) | Real rotation beats .env. |
| Observability | OpenTelemetry + Grafana Cloud + Sentry + PostHog | Free tiers, production-grade. |
| Testing | Jest + Supertest + Testcontainers + Playwright + Maestro + k6 | Full pyramid. |
| Docs | OpenAPI auto-gen + Storybook + ADRs (MADR) | Self-updating. |
| CI/CD | GitHub Actions + Turborepo remote cache + Docker Buildx + Trivy | Cached, parallel, secure. |
| Infra (v1) | Docker Compose (dev) · Fly.io/Railway (prod) | Free → paid path. |
| Infra (later) | Terraform → AWS ECS/EKS | Scaffold ready. |

---

## Chapter 9 — Clean / Hexagonal Architecture

### 9.1 The Four Layers (Per Module)

```
modules/<context>/
  domain/          Pure TS — entities, value objects, domain services, events.
                   No framework imports. No I/O. Unit-tested in isolation.
  application/     Use cases (command/query handlers). Orchestrates domain + ports.
                   Defines repository interfaces (ports). Depends only on domain.
  infrastructure/  Adapters: Prisma repositories, HTTP clients, queue producers,
                   external API wrappers. Implements ports from application.
  interface/       Controllers (HTTP/tRPC/WS), DTOs, validators (class-validator),
                   mappers. Thin — delegates to use cases.
  <context>.module.ts   Wires it all with Nest DI.
```

### 9.2 The Dependency Rule
`domain ← application ← infrastructure/interface`. Never the other way.

### 9.3 Enforcement
ESLint `import/no-restricted-paths` and Turborepo boundary lint. See Chapter 17.6 for the exact rule set.

### 9.4 Why This Matters
Future microservice extraction is a *refactor*, not a rewrite. You swap the repository adapter from Prisma to an HTTP client; the domain and use cases don't change.

---

## Chapter 10 — Monorepo Structure

```
travel-superapp/
├── apps/
│   ├── api/                        NestJS modular monolith
│   │   ├── src/
│   │   │   ├── modules/            17 bounded contexts (Ch 7.2)
│   │   │   ├── common/             guards, interceptors, filters, pipes
│   │   │   ├── config/             typed config (zod-validated)
│   │   │   └── main.ts
│   │   ├── prisma/                 schema, migrations, seeds
│   │   ├── test/
│   │   └── Dockerfile
│   ├── web/                        Next.js 15 (user-facing)
│   ├── admin/                      Next.js 15 (internal ops)
│   ├── mobile/                     React Native + Expo 51
│   ├── ai-service/                 Python FastAPI
│   ├── media-service/              Node Sharp worker
│   ├── notification-worker/        NestJS standalone + BullMQ
│   └── crawler-worker/             NestJS standalone + Playwright
├── packages/
│   ├── shared-types/               Zod schemas + TS types
│   ├── ui/                         shadcn + Tailwind web design system
│   ├── mobile-ui/                  Tamagui RN design system
│   ├── sdk/                        Auto-generated API client from OpenAPI
│   ├── logger/                     Pino wrapper
│   ├── config/                     Validated env schemas
│   ├── errors/                     Domain error hierarchy
│   ├── observability/              OTel + metrics + Sentry
│   ├── eslint-config/              Shared flat ESLint config
│   └── tsconfig/                   Base tsconfig variants
├── infra/
│   ├── docker-compose.yml          local dev (pg, redis, meilisearch, minio, mailpit, jaeger, prometheus, grafana)
│   ├── docker-compose.prod.yml
│   ├── k8s/                        Helm charts (optional for v1)
│   └── terraform/                  AWS skeleton
├── .github/
│   └── workflows/                  ci, cd, security, preview, release
├── docs/
│   ├── adr/                        Architecture Decision Records (MADR)
│   ├── api/                        OpenAPI snapshots
│   ├── runbooks/                   Oncall guides
│   └── onboarding.md
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

# Part III — Implementation Blueprints

## Chapter 11 — Code Patterns & Conventions

### 11.1 Typed, Validated Config (Nest + Zod)
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
  // ...all env vars
});
export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }
  return result.data;
}
```

### 11.2 Use-Case Pattern
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
    const candidates = await this.places.findWithinRadius(
      cmd.center, cmd.radiusKm, cmd.filters
    );
    const itinerary = await this.ai.planItinerary({ candidates, prefs: cmd.prefs });
    const trip = Trip.createDraft(cmd.userId, cmd.center, itinerary);
    await this.repo.save(trip);
    this.events.publish(new TripDraftedEvent(trip.id));
    return TripMapper.toDto(trip);
  }
}
```

### 11.3 Guards: JWT + RBAC
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'premium')
@Controller('trips')
export class TripController { /* ... */ }
```

### 11.4 Rate Limiting (Redis Sliding Window)
```ts
@UseGuards(ThrottlerGuard)
@Throttle({ ai: { limit: 10, ttl: 60_000 } })   // 10 AI calls/min/user
```

### 11.5 Error Handling (Centralized)
```ts
// common/filters/domain-exception.filter.ts
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost) {
    // Map domain codes → HTTP, log with trace id, scrub PII
  }
}
```

### 11.6 Structured Logging (Pino + Trace Correlation)
```ts
logger.info({ userId, tripId, traceId }, 'itinerary_generated');
```

### 11.7 Extensibility Principles
- **Feature flags** (PostHog / OpenFeature) gate every new feature.
- **Config-driven** scoring weights, pricing rules, LLM prompts — all in DB, hot-reloaded, not hardcoded.
- **Strategy pattern** for swappable adapters: places data source, translator, hotel provider.
- **Event-driven** cross-context integration — new module = subscribe to events, no edits elsewhere.
- **Versioned APIs** (`/v1/…`) from day one; deprecation headers before removal.

---

## Chapter 12 — Data Modeling

### 12.1 Prisma Schema Highlights
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

### 12.2 PostGIS Considerations
`Unsupported("geography(Point,4326)")` means Prisma won't generate typed queries on that column. You MUST supplement with a small raw-SQL `GeoQueries` service that wraps `$queryRaw` / `$executeRaw`.

**Example:**
```sql
SELECT *, ST_Distance(coordinates, ST_MakePoint($1, $2)::geography) AS distance_m
FROM "Place"
WHERE ST_DWithin(coordinates, ST_MakePoint($1, $2)::geography, $3 * 1000)
ORDER BY distance_m;
```

**Rule for AI agents:** never call `prisma.place.create({ data: { coordinates: ... } })`. Always go through `GeoQueries.insertPlace()`.

### 12.3 pgvector for Embeddings
Vector similarity query:
```sql
SELECT * FROM "PlaceEmbedding" ORDER BY embedding <-> $1 LIMIT $2
```
Indexed with IVFFlat (good for 100k–1M rows) or HNSW (better recall, more memory). Start with IVFFlat.

### 12.4 Required Indexes
At minimum, declare:
- `Trip @@index([userId, status, createdAt])`
- `Session @@index([userId, revokedAt])`
- `CrimeIncident @@index([lat, lng, reportedAt])` (or GiST on a geography column)
- `NotificationLog @@index([userId, read, createdAt])`
- `User @@unique([emailHash])` — critical, not optional

### 12.5 Extensions Declaration
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "tracing"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis, postgisTopology, vector, pg_trgm, pgcrypto]
}
```
The extension package name is `vector` (not `pgvector`).

### 12.6 Soft Delete Policy
Don't mix-and-match. Either commit to soft-delete everywhere with a Prisma middleware that filters, or rely on GDPR anonymization only. The v1 compendium had `User.deletedAt` but no other table — that's inconsistent.

---

## Chapter 13 — Security

### 13.1 Input Validation
`class-validator` DTOs + Zod at service boundaries. Reject unknown fields. Zod schemas from Chapter 11 are the source of truth.

### 13.2 Authentication
- **Passwords:** argon2id (timeCost: 3, memoryCost: 65536). Never SHA/bcrypt.
- **Tokens:** JWT access 15m + rotating refresh 30d in httpOnly, SameSite=strict, Secure cookie.
- **MFA:** TOTP via speakeasy, required for premium + agents.
- **OAuth2:** Google, Apple. Auto-verify email for OAuth users.
- **JWKS:** support JWT key rotation from day one — add `kid` header, store current + previous key ID in Redis.
- **Session concurrency:** cap active sessions per user (10). On limit, revoke oldest.
- **Device binding:** bind refresh-token claim to device fingerprint hash; reject mismatch.

### 13.3 Authorization
CASL-based policy layer. Deny by default. Per-resource ownership checks — no IDOR.

### 13.4 Rate Limiting
Redis sliding window per IP + per user + per endpoint class (AI especially). Key rate limits by `sha256(email + pepper)`, never raw email (PII in Redis).

### 13.5 Password Reset Flow
- `POST /auth/forgot-password` — time-limited signed token (15m TTL) stored hashed in Redis. Rate-limit 3/hr/email.
- `POST /auth/reset-password` — consume token, invalidate it, revoke all sessions.

### 13.6 Account Enumeration Prevention
- Register: return identical timing + message for "email taken" and generic failure.
- Login: always return same "invalid credentials" regardless of whether email exists.
- Forgot-password: always return 200 regardless of whether email exists.

### 13.7 MFA Backup Codes
HMAC-SHA256 with a server-side pepper, stored as a single hashed string per code. (Argon2 is too slow for bulk lookup — don't use it for this.)

### 13.8 CSRF Protection
Cookie-bound refresh tokens need double-submit CSRF on state-changing routes. Use `@fastify/csrf-protection` + `X-CSRF-Token` header.

### 13.9 Transport Security
- TLS 1.3 everywhere; HSTS preload.
- mTLS between internal services in prod.
- Helmet + strict CSP with nonces for inline scripts.
- Trusted Types header. COOP/COEP for mobile webviews. Permissions-Policy (deny camera/mic/geo unless route opts in).

### 13.10 Secrets
Doppler; rotation; never in images; scanned by gitleaks in CI.

### 13.11 PII Handling
- Field-level encryption for phone / email (pgcrypto).
- Email stored as encrypted + `emailHash` (SHA-256 with pepper) for lookup.
- DPIA documented in `docs/legal/dpia.md`.

### 13.12 Compliance
GDPR + India DPDP + COPPA-aware. Data export + delete APIs from day one. See Chapter 30 for full delete flow.

### 13.13 Container Security
Distroless base images. Non-root. Trivy image scan. SBOM (CycloneDX).

### 13.14 OWASP Mobile Top 10
Cert pinning, secure storage (Keychain/Keystore), root/jailbreak detect for premium flows.

---

## Chapter 14 — Testing Strategy

### 14.1 The Testing Pyramid
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

### 14.2 Coverage Thresholds
- `domain/` ≥ 80%
- `application/` ≥ 80%
- Overall ≥ 60%
- Enforced in Jest config; CI fails if thresholds drop.

### 14.3 Contract Tests
Pact between api and mobile/web SDKs.

### 14.4 Property-Based Tests
fast-check for pricing, scoring, geo math.

### 14.5 Load Tests
k6 nightly in CI against staging. SLO: p95 < 300 ms reads, < 800 ms AI endpoints (excluding LLM time).

### 14.6 Chaos Tests
Toxiproxy monthly — DB / Redis latency injection.

### 14.7 Example Test
```ts
it('fails when radius exceeds 500km', async () => {
  const uc = new GenerateItineraryUseCase(places, ai, repo, events);
  await expect(uc.execute({ ...cmd, radiusKm: 501 }))
    .rejects.toThrow(InvalidRadiusError);
  expect(ai.planItinerary).not.toHaveBeenCalled();
});
```

---

## Chapter 15 — Observability & Error Handling

### 15.1 Error Model
`DomainError` base with `code`, `httpStatus`, `context`. Mapped by a global filter. Clients get `{ code, message, traceId, details }`.

### 15.2 Logging
Pino JSON logs → stdout → Grafana Loki. Trace id on every log. PII scrubbing list:
```
redact: ['req.headers.authorization', 'req.headers.cookie',
         'email', 'password', '*.password', '*.token', '*.refreshToken']
```

### 15.3 Metrics
`prom-client` exposes `/metrics`. RED metrics per endpoint + domain counters: `trips_generated`, `sos_triggered`, `bookings_converted`, `ai_requests_total{model,operation}`, `active_trips_current`.

### 15.4 Tracing
OpenTelemetry SDK auto-instruments Nest, Prisma, Redis, HTTP clients → Grafana Tempo.

### 15.5 Alerting
Grafana alerts on SLO breaches + Sentry for exceptions → Slack + PagerDuty (premium).

### 15.6 SLO Catalog
Maintain `docs/slo/slo-catalog.md` with targets (trip gen p95 < 3 s, places search p95 < 300 ms, availability 99.5%) and associated error budgets.

### 15.7 Dashboards as Code
Grafana provisioned via `infra/grafana/dashboards/*.json` in the repo. Never clicked together in the UI.

### 15.8 Documentation
- README per app with quickstart + architecture link.
- OpenAPI auto-generated from Nest decorators → `docs/api/openapi.yaml` → Stoplight-rendered.
- SDK auto-generated from OpenAPI (orval) → `packages/sdk` used by web + mobile (one source of truth).
- Storybook for web + mobile UI.
- ADRs in `docs/adr` (MADR format) for every significant decision.
- Onboarding doc gets a new engineer productive in one day.

---

# Part IV — The Build Compendium

## Chapter 16 — Feasibility Verdict

### 16.1 Overall Score
**8 / 10** for the v1 Build Prompt Compendium. Feasible, ship-worthy after the upgrades in Chapters 17–19.

### 16.2 Scorecard

| Dimension | Rating | Note |
|---|---|---|
| Structural completeness | 9/10 | Phase/block structure is clean and sequential. |
| Technical accuracy | 7/10 | Outdated/buggy picks (Chapter 17). Nothing fatal. |
| AI-agent friendliness | 5/10 | Prompts written for humans. Missing meta-rails. |
| Security depth | 7/10 | Solid foundations, 8 specific gaps (17.3). |
| Observability depth | 6/10 | OTel wired; PII scrubbing, SLOs, dashboards-as-code missing. |
| Scope realism | 7/10 | Phase 0 timeline realistic; Phase 1 optimistic for solo. |
| Block completeness | 6/10 | Phase 0 complete; ~12 critical blocks still missing. |

### 16.3 Realistic Timeline

| Team shape | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total to full v1 |
|---|---|---|---|---|---|---|
| Solo + AI agent | 4–5 weeks | 4–5 months | 3 months | 4 months | Ongoing | 12–15 months |
| 2 devs + AI | 2–3 weeks | 2.5–3 months | 1.5–2 months | 2.5 months | Ongoing | 7–9 months |
| 4 devs + 1 designer + AI | 1.5–2 weeks | 1.5–2 months | 1–1.5 months | 2 months | Ongoing | 5–6 months |

Assumptions: all devs competent in the stack, clear backlog, no pivots, QA embedded.

### 16.4 Verdict
Do the upgrades below before feeding to an AI coding agent. Otherwise you'll burn 20–30% of tokens on rework.

---

## Chapter 17 — Bugs in the v1 Compendium (Fix Inline)

### 17.1 Dependency Issues (Block 0.5)

| You have | Fix to | Why |
|---|---|---|
| `@nestjs/bull` | `@nestjs/bullmq` | `@nestjs/bull` is legacy (Bull v3). |
| (missing) | `@nestjs/terminus` | Health checks — required for Fly.io / K8s probes. |
| (missing) | `@fastify/csrf-protection` | You mention CSRF double-submit — needs this on Fastify. |
| (missing) | `@nestjs/cache-manager` + `cache-manager-redis-yet` | Unified cache abstraction instead of raw ioredis. |
| (missing) | `pino-pretty` as devDep only | Guard with NODE_ENV or prod build fails. |

### 17.2 Prisma Schema Issues (Block 0.5)
- `Unsupported("geography(Point,4326)")` — see Chapter 12.2; supplement with raw-SQL wrapper.
- Extensions syntax: `extensions = [postgis, postgisTopology, vector, pg_trgm, pgcrypto]`. Package name is `vector`, not `pgvector(map: "vector")`.
- `emailHash` needs `@unique` or `@@index([emailHash])`. Lookup without index = table scan.
- Missing indexes: see Chapter 12.4.
- Soft-delete inconsistency: commit to it everywhere or drop it entirely.

### 17.3 Security Gaps (Block 0.6)

| # | Gap | Fix |
|---|---|---|
| S1 | No password reset flow | Chapter 13.5. |
| S2 | Account enumeration on register/login | Chapter 13.6. |
| S3 | Backup codes hashed with argon2id | Use HMAC-SHA256 (Chapter 13.7). |
| S4 | No CSRF token for refresh endpoint | Chapter 13.8. |
| S5 | No JWT `kid` / key rotation | Add JWKS (Chapter 13.2). |
| S6 | Rate-limit keys leak PII | Key by `sha256(email + pepper)` (Chapter 13.4). |
| S7 | Missing session concurrency limit | Cap active sessions per user (Chapter 13.2). |
| S8 | No device fingerprint binding | Bind refresh-token to device hash (Chapter 13.2). |

### 17.4 Observability Gaps (Block 0.3)
- PII scrubbing on Pino — see Chapter 15.2.
- SLO catalog — Chapter 15.6.
- Dashboards-as-code — Chapter 15.7.
- Error-budget policy → `docs/runbooks/error-budget-policy.md`.

### 17.5 Testing Infrastructure Gaps
Block 0.5/0.6 reference Testcontainers but no block sets it up. Add Block 0.7 (see Chapter 18.1).

### 17.6 Prompt-Block–Level Issues
- **Block 0.4:** "50+ categories" listed only ~15. Enumerate all 50 or move to DB-driven category table.
- **Block 0.5:** imports `'../instrumentation'` but no block creates `apps/api/instrumentation.ts`. Add it.
- **Block 0.6:** references `@app/errors` but Block 0.3 creates `packages/errors` — import alias never specified. Pick `@app/*` (recommended) and write it into the root `tsconfig.json` `paths` section.

---

## Chapter 18 — Missing Blocks

### 18.1 Phase 0 Additions

**[0.7] Testing Infrastructure** — Testcontainers (Postgres + Redis + Meilisearch per integration test), Jest config per app, factories with @faker-js/faker, MSW/nock for external API mocking, global setup/teardown, coverage thresholds enforced.

**[0.8] Database Seeding & Migrations** — `prisma/seed.ts` with dev/test/demo datasets, idempotent upserts, migration naming convention, zero-downtime migration playbook (add-then-backfill-then-drop).

**[0.9] Event Bus (Redis Streams Adapter)** — `packages/events` with typed EventBus, Redis Streams adapter, consumer groups per module, dead-letter stream. Swap-to-Kafka seam.

**[0.10] Feature Flags + Remote Config** — OpenFeature + PostHog provider, `@FeatureFlag()` decorator, config-driven LLM prompts stored in DB + hot-reloaded via Redis pubsub.

**[0.11] CI/CD Pipeline** — GitHub Actions: `ci.yml`, `security.yml`, `cd.yml`, `preview.yml`, `release.yml`. Turbo remote cache. See Chapter 33.

**[0.12] API SDK Auto-generation** — `packages/sdk` via orval. CI check that fails if OpenAPI changed but SDK not regenerated. React Query hooks auto-generated.

**[0.13] i18n Foundation** — `packages/i18n` ICU messageformat, `next-intl` for web, `i18next` for mobile. Key extraction via `i18next-parser` in CI. Namespaces: `common`, `auth`, `trip`, `safety`, etc. **Must be Phase 0 — retrofitting is 10× more expensive.**

**[0.14] Frontend Scaffolds (3 sub-blocks)**
- **0.14.a apps/web** — App Router, RSC, shadcn + Tailwind, auth middleware, SDK integration, PostHog client, Sentry browser, i18n, themes, ErrorBoundary, 404/500, robots, sitemap, OpenGraph.
- **0.14.b apps/admin** — stricter RBAC, no marketing layer, audit logging on mutations, separate Vercel deploy, optional IP allowlist.
- **0.14.c apps/mobile** — expo-router, Tamagui, MMKV, WatermelonDB, secure-store, biometric auth, expo-notifications, deep linking, OTA policy, Sentry.

**[0.15] Idempotency & Webhooks** — idempotency-key middleware (hash request, store result Redis 24h). Stripe webhook handler with signature verification. Generic webhook framework for Booking/Twilio/etc.

**[0.16] Health / Readiness / Liveness** — `@nestjs/terminus`. `/health/live`, `/health/ready`, `/health/startup` with health indicators per dependency.

**[0.17] Security Headers + CORS + CSP** — strict CSP with nonces, per-env CORS allowlist from env var, Trusted Types, COOP/COEP, Permissions-Policy.

**[0.18] Phase 0 Smoke & Acceptance Suite** — end-of-phase automated script running all ACs. Lives in `tests/smoke/phase-0.smoke.ts`. CI fails if any regresses.

### 18.2 Phase 1 Additions (Beyond 1.1 and 1.2 in v1)

- **1.3** Stays module (search, dedup, affiliate deeplink, price history).
- **1.4** Food & Tryouts module.
- **1.5** Transport & Routing module (mode-fit, ETA, transit schedules, ride-hail deeplinks).
- **1.6** Weather module (Open-Meteo proxy + cache + alerts).
- **1.7** Translation module (ai-service proxy, on-device NLLB option).
- **1.8** Offline pack generator (map tiles + itinerary JSON + translator phrases).
- **1.9** Notifications module (multi-channel fan-out, DND, quiet hours).
- **1.10** Payments module (Stripe subs + affiliate tracking).
- **1.11** ai-service skeleton (Python FastAPI + Ray Serve + model loaders).
- **1.12** Mobile: offline-first trip viewer with sync conflict resolution.
- **1.13** Phase 1 Smoke Test Suite.

---

## Chapter 19 — Agent Meta-Layer (Safety Rails)

The single biggest upgrade to the compendium. Without these, AI agents rewrite files, install random deps, commit secrets, skip tests, and invent APIs.

### 19.1 System Rules Preamble (Prepend Before Block 0.1)

```
═════════════════════════════════════════════════
SYSTEM RULES FOR ALL PROMPT BLOCKS — READ FIRST
═════════════════════════════════════════════════

Safety Rails (HARD CONSTRAINTS — never violate):
  1. NEVER modify files outside the files-to-create/edit list for the current block.
  2. NEVER install npm/pip/brew dependencies not explicitly listed in the block.
  3. NEVER delete a file you did not create in the current block.
  4. NEVER commit to git unless the user says "commit this".
  5. NEVER write secrets, API keys, or credentials — use REPLACE_ME_SEE_DOPPLER.
  6. NEVER skip the ACCEPTANCE CRITERIA verification step.
  7. NEVER proceed to the next block without user confirmation.
  8. If a block conflicts with existing code, STOP and ask.
  9. If uncertain about a design choice, STOP and ask.
 10. Treat prisma/schema.prisma as append-only unless told otherwise.
```

### 19.2 Context Carry Protocol
At the start of each block, the user pastes a "CONTEXT SUMMARY" from the previous block's output. Treat it as authoritative. Don't re-read prior files you don't need.

### 19.3 Output Format (Required at End of Every Block)
1. `FILES CREATED:` list
2. `FILES EDITED:` list
3. `DEPENDENCIES ADDED:` list with versions
4. `COMMANDS TO RUN:` numbered list
5. `VERIFICATION:` expected output
6. `NEXT BLOCK:` block number + context to carry

### 19.4 Self-Check Before Declaring Done
- [ ] All files in spec exist at correct paths.
- [ ] TypeScript compiles (`pnpm turbo run typecheck --filter=<pkg>`).
- [ ] Lint passes (`pnpm turbo run lint --filter=<pkg>`).
- [ ] No unresolved `// TODO`.
- [ ] No `any` types (unless allowed).
- [ ] No `console.log` (use logger package).
- [ ] Acceptance criteria met or clearly blocked.

### 19.5 Escalation ("BLOCKED" Report Format)
- What I tried.
- What failed (paste exact error).
- What I need from the user to unblock.
- Do NOT guess or proceed.

### 19.6 Per-Block Footers

**Context to carry into next block:**
- Files created in this block.
- Key interfaces exported (with paths).
- Decisions made (branch points).
- Deviations from spec (for user review).

**Token budget:**
- Expected files: N–M.
- Expected output: ~X lines.
- If about to generate > 2×, STOP and ask if you should split.

**Common pitfalls** (per block): concrete list of mistakes previous agents made.

**Rollback instructions:**
```
git checkout -- <files>
rm -rf <new directories>
pnpm install
```

---

## Chapter 20 — Recommended Compendium Table of Contents

```
PHASE 0 — FOUNDATION (Weeks 1–4)
  0.0  System Rules & Meta-Layer                    [NEW — Chapter 19]
  0.1  Monorepo Scaffold & Toolchain                [keep, fix 17.6]
  0.2  Docker Compose Local Dev Stack               [keep]
  0.3  Shared Packages (config/logger/errors/obs)   [keep, fix 17.4]
  0.4  shared-types Package                         [keep, enumerate categories]
  0.5  NestJS API Skeleton + Cross-Cutting          [keep, fix 17.1/17.2]
  0.6  Identity Module (Auth)                       [keep, fix 17.3]
  0.7  Testing Infrastructure                       [NEW]
  0.8  Database Seeding & Migrations                [NEW]
  0.9  Event Bus (Redis Streams)                    [NEW]
  0.10 Feature Flags + Remote Config                [NEW]
  0.11 CI/CD Pipeline                               [NEW]
  0.12 API SDK Auto-generation                      [NEW]
  0.13 i18n Foundation                              [NEW]
  0.14 Frontend Scaffolds (web/admin/mobile)        [NEW — 3 sub-blocks]
  0.15 Idempotency & Webhooks                       [NEW]
  0.16 Health / Readiness / Liveness                [NEW]
  0.17 Security Headers + CORS + CSP                [NEW]
  0.18 Phase 0 Smoke Test Suite                     [NEW]

PHASE 1 — CORE MVP (Months 2–5, revised)
  1.1  Places Catalog                               [keep]
  1.2  Trip Planning + AI Orchestration             [keep — the core]
  1.3  Stays Module                                 [NEW]
  1.4  Food & Tryouts Module                        [NEW]
  1.5  Transport & Routing Module                   [NEW]
  1.6  Weather Module                               [NEW]
  1.7  Translation Module                           [NEW]
  1.8  Offline Pack Generator                       [NEW]
  1.9  Notifications Module                         [NEW]
  1.10 Payments Module (Stripe + affiliate)         [NEW]
  1.11 ai-service Skeleton (Python FastAPI)         [NEW]
  1.12 Mobile Offline-First Trip Viewer             [NEW]
  1.13 Phase 1 Smoke Test Suite                     [NEW]

PHASE 2 — SAFETY & LIVE (Months 6–8)
  2.1  Crime & Safety Layer
  2.2  Scam Database & Agent Marketplace (KYC + Escrow)
  2.3  Emergency SOS
  2.4  Live Companion (Geofencing + Re-plan)
  2.5  Events & Culture
  2.6  Social & Groups (Shared Trips + Expense Split)
  2.7  Freemium Launch (Stripe subs + gating)
  2.8  Women-Solo / LGBTQ+ Safety Overlays
  2.9  Phase 2 Smoke Test Suite

PHASE 3 — WOW LAYER (Months 9–12)
  3.1  3D Destination Previews (Cesium + Google Tiles)
  3.2  Animated Itinerary Map
  3.3  Crowd Analytics (Satellite + Popular Times ML)
  3.4  Iconic Photo Templates (with AR alignment)
  3.5  Price Aggregator (Booking + Amadeus + Expedia)
  3.6  Fake-Review Detection (DistilBERT)
  3.7  Memory Book (post-trip)
  3.8  Public Shareable Templates
  3.9  B2B Pilot Endpoints
  3.10 Phase 3 Smoke Test Suite

PHASE 4 — POLISH & SCALE (Month 12+)
  4.1  Gamification
  4.2  Carbon Footprint + Greener Swaps
  4.3  "Call a Guide" Video (Daily.co / LiveKit)
  4.4  Fine-tune Llama on real trips (LoRA)
  4.5  Multi-region Deployment
  4.6  SOC 2 Type I Readiness
```

---

# Part V — Economics

## Chapter 21 — Build-Time Token Economics

Most people feed prompts to an AI agent blind and get sticker-shocked. Here's the math.

### 21.1 Cost Per Block (Claude Sonnet 4.6)

| Block type | Input tokens | Output tokens | Cache hit % | Sonnet cost | Haiku cost |
|---|---|---|---|---|---|
| Scaffold (0.1, 0.2) | 8–12k | 4–6k | 0% | $0.10–0.18 | $0.01–0.02 |
| Shared package (0.3, 0.4) | 15–20k | 10–15k | 60% | $0.12–0.20 | $0.02–0.04 |
| Cross-cutting (0.5) | 25–35k | 20–30k | 70% | $0.25–0.40 | $0.04–0.07 |
| Domain module (0.6, 1.1, 1.2) | 40–60k | 25–40k | 75% | $0.35–0.60 | $0.06–0.12 |
| Frontend scaffold (0.14) | 30–45k | 15–25k | 65% | $0.25–0.45 | $0.04–0.08 |
| Test / infra (0.7, 0.11) | 20–30k | 10–15k | 70% | $0.15–0.25 | $0.03–0.05 |

**Totals:**
- Phase 0 (18 blocks): ~$4.50–8.00 Sonnet.
- Phase 1 (13 blocks): ~$6.00–10.00 Sonnet.
- Typical Phase 0 + 1 Sonnet build: **$10–18**. Double for rework (**$20–40**). Triple if no prompt caching (**$60–120**).

### 21.2 Prompt-Caching Strategy (Must-Have)

Cut 90% of input cost on repeat context:

```
CACHE LAYER 1 (ephemeral_5m, refreshed every block):
  - System Rules preamble (Ch 19.1)           ~2k tokens
  - Current block spec                        ~3–5k tokens
  - Context summary from prior block          ~1k tokens

CACHE LAYER 2 (ephemeral_1h, refreshed per phase):
  - Architecture overview                     ~3k tokens
  - Shared-types reference                    ~4k tokens
  - Prisma schema                             ~5k tokens
  - Error catalog                             ~1k tokens

CACHE LAYER 3 (ephemeral_1h):
  - Prior block's key files (summaries)       ~5k tokens
```

### 21.3 Model Routing by Block Type

| Block type | Model | Why |
|---|---|---|
| Pure scaffolding / config | Haiku 4.5 | Zero reasoning needed. |
| Prisma schema / types | Sonnet 4.6 | Type discipline required. |
| Domain logic / use cases | Sonnet 4.6 | Architectural judgment. |
| Ambiguous / design-heavy (trip AI) | Opus 4.7 + extended thinking | Worth the spend. |
| Test authoring | Haiku 4.5 | Pattern matching. |
| Refactor / bug fix | Sonnet 4.6 | Careful edits. |
| Code review pass | Opus 4.7 | Catches what others miss. |

### 21.4 Budget Alarms (Set Before You Start)
- Anthropic usage alerts at $10, $50, $100.
- Stripe weekly budget notification.
- GitHub Actions hard-cap at 50k minutes/month.
- Fly.io / Vercel / Supabase upgrade gates (never auto-upgrade).

---

## Chapter 22 — Runtime LLM Economics

### 22.1 Per-Feature Cost Breakdown

| Feature | Model | Tokens/call | Cost/call | Calls/user/mo | Cost/user/mo |
|---|---|---|---|---|---|
| Generate itinerary | Sonnet 4.6 | 12k in / 8k out | $0.156 | 1.5 | $0.23 |
| Re-plan | Sonnet 4.6 | 8k in / 4k out | $0.084 | 0.5 | $0.04 |
| Chat / edit suggestions | Haiku 4.5 | 2k in / 0.5k out | $0.004 | 20 | $0.08 |
| Translation (NLLB self-host) | — | — | $0 | 100 | ~$0.02 |
| Fake-review (DistilBERT) | — | — | $0 | 5 | ~$0.001 |
| Embeddings | Voyage / OpenAI | 1k | $0.00002 | 10 | negligible |

**Per-active-user LLM cost: ~$0.37/mo. With prompt caching → ~$0.15/mo.**

### 22.2 Caching Levers
- **Translation caching** (sha256(text + target_lang), 7d TTL): saves 70%+ at high volume.
- **Prompt caching** on SYSTEM prompt + schemas: 60–80% input cost reduction.
- **Itinerary template caching** for popular city + common preferences: 40% cache hit rate after month 3.

### 22.3 Profitability Rule
Free-tier unit economics are tight: affiliate commission averages $2–8 / user / month only if conversion is 2–5%. You need caching + Haiku routing to be profitable below 5% conversion.

---

## Chapter 23 — Unit Economics & Break-Even

### 23.1 COGS per MAU (Steady State, 10k MAU)

| Item | Cost |
|---|---|
| Infra (Fly api + Supabase pro + Redis + R2) | $0.04 |
| LLM (with caching + Haiku routing) | $0.15 |
| Google Places / Foursquare / etc. | $0.08 |
| Mapbox / Google Maps | $0.06 |
| Satellite / crowd data | $0.02 |
| Push / email / SMS | $0.03 |
| Sentry / PostHog / observability | $0.02 |
| Stripe fees (paid users only) | variable |
| **Total COGS per MAU** | **~$0.40** |

### 23.2 Revenue per MAU (Blended)

| Source | % MAU monetizing | ARPU contribution |
|---|---|---|
| Affiliate commissions | 3–5% book | $0.60–1.20 |
| Pro subscription ($4.99/mo, 3% conversion) | 3% | $0.15 |
| Sponsored listings (Phase 3+) | n/a | $0.05 |
| **Blended ARPU** | | **$0.80–1.40** |

### 23.3 Break-Even
COGS $0.40, ARPU $1.00 → gross margin ~60%, contribution **$0.60/MAU**.

To cover a $300k/yr burn (2 devs + founder), need $25k/mo contribution = **~42k MAU**. Achievable in 12 months if launch goes well; aggressive.

### 23.4 Cost & Revenue Levers

| Lever | Impact |
|---|---|
| Prompt caching on LLM | COGS −$0.10 → margin 70% |
| Shift itinerary gen to fine-tuned Llama | COGS −$0.12 → margin 75% |
| Raise Pro price to $7.99 | ARPU +$0.12 |
| Push Pro conversion 3% → 5% | ARPU +$0.10 |
| Direct hotel partnerships vs Booking.com | ARPU +$0.30 |

### 23.5 What Kills This Business
- Uncached LLM costs (COGS doubles → margin dies).
- Uncapped Google Places spend spiraling.
- Affiliate commission claw-backs on cancellations (build a reserve buffer).
- High CAC if organic growth fails (public trip templates must deliver).

---

# Part VI — Execution Playbook

## Chapter 24 — Block Lifecycle State Machine

### 24.1 The Eight States

```
PROPOSED → DRAFTED → CODED → TYPECHECKED → UNIT-TESTED
         → INTEGRATION-TESTED → VERIFIED → SIGNED-OFF → ARCHIVED
```

### 24.2 Exit Criteria Per State

| State | Must produce | Proceed only if |
|---|---|---|
| DRAFTED | File tree + 1-line purpose per file | Human says "proceed". |
| CODED | All files fully implemented (no `throw new NotImplemented`) | `pnpm --filter=<pkg> build` succeeds. |
| TYPECHECKED | Zero TS errors repo-wide | `turbo run typecheck` green. |
| UNIT-TESTED | Coverage report | domain/app ≥ 80%. |
| INTEGRATION-TESTED | Test output artifact | All ACs from block spec pass. |
| VERIFIED | Video / screenshot evidence | Human signs `block-<n>-verification.md`. |
| SIGNED-OFF | Git commit SHA | PR merged, CI green on main. |

### 24.3 Artifacts Per State (Institutional Memory)

In `docs/blocks/block-<n>/`:
- `spec.md` — original prompt
- `draft.md` — agent's file plan
- `diff.patch` — actual code changes
- `test-output.txt` — test runner output
- `verification.md` — checklist signed off
- `retrospective.md` — what went wrong / was surprising

After 30 blocks you have a playbook of patterns that worked and didn't.

### 24.4 Rollback Policy

| From state | Rollback command |
|---|---|
| DRAFTED | Delete `draft.md` — no code yet. |
| CODED | `git checkout -- apps/<pkg>` + `pnpm install`. |
| TYPECHECKED | Same as CODED. |
| UNIT-TESTED | `git revert <SHA>` if committed, else checkout. |
| VERIFIED | `git revert` — never amend published commits. |

---

## Chapter 25 — Parallelization & Dependency DAG

### 25.1 Phase 0 DAG

```
0.0 ──┐
      ▼
   0.1 Monorepo ──┬────────────────────────────────────┐
                  ▼                                    ▼
               0.2 Docker                           0.3 Shared packages
                  │                                    │
                  └────────────┬───────────────────────┘
                               ▼
                           0.4 shared-types
                               │
                               ▼
                           0.5 NestJS skeleton ─┬────┬────┬────┐
                               │                ▼    ▼    ▼    ▼
                               ▼               0.7  0.8  0.9  0.10
                            0.6 Identity      (parallel: test infra, seeds, events, flags)
                               │                ▲    ▲    ▲    ▲
                               └────────────────┴────┴────┴────┘
                                                │
                                                ▼
                                          0.11 CI/CD
                                                │
                              ┌─────────────────┼────────────────────┐
                              ▼                 ▼                    ▼
                           0.12 SDK         0.13 i18n            0.14 Frontends (a/b/c parallel)
                              │                 │                    │
                              └─────────────────┼────────────────────┘
                                                ▼
                                         0.15 Idempotency
                                                │
                                                ▼
                                         0.16 Health
                                                │
                                                ▼
                                         0.17 Security headers
                                                │
                                                ▼
                                         0.18 Phase 0 smoke
```

### 25.2 Parallelization Opportunities

| Pair | Parallel? | Notes |
|---|---|---|
| 0.2 Docker + 0.3 Shared | ✅ | Zero overlap. |
| 0.7, 0.8, 0.9, 0.10 | ✅ | All independent after 0.6. |
| 0.12 SDK + 0.13 i18n + 0.14a/b/c | ✅ | Four parallel frontend streams. |
| 1.3 Stays + 1.4 Food + 1.6 Weather + 1.7 Translation | ✅ | Independent after 1.1 Places. |
| 1.5 Transport + 1.2 Trip | ⚠️ | Only if contracts are locked first. |
| 1.9 Notifications + 1.10 Payments | ✅ | Independent. |

### 25.3 Critical Path

```
0.0 → 0.1 → 0.2/0.3 → 0.4 → 0.5 → 0.6 → 0.11 → 0.14 → 0.18
   → 1.1 → 1.2 → 1.11 (ai-service) → 1.13
```

- **Solo:** ~14–16 weeks for Phase 0 + 1.
- **Two-dev parallel:** ~9–11 weeks (A owns API, B owns mobile + frontend).
- **Three-dev parallel:** ~6–8 weeks (C on ai-service + infra).

---

## Chapter 26 — Agent-Tool Optimization

### 26.1 Claude Code (CLI)
Excellent with long structured prompts, plan-mode, multi-file edits. Put System Rules (19.1) in a `CLAUDE.md` at repo root — auto-loads every session. Use plan-mode for each block before execution; cuts rework ~30%. Two-stage: draft file list + interfaces first, review, then implement.

### 26.2 Cursor
Best for tight-loop edits on already-scaffolded code. Poor at cold-start scaffolding. Feed scaffolding to Claude Code first, switch to Cursor from Block 0.6 onward. Enable "Rules for AI" with compact System Rules. Composer for multi-file, single-file for quick fixes.

### 26.3 GitHub Copilot Workspace
Best for generating tests from implementations (Block 0.7). Treat as typing accelerator, not architectural tool.

### 26.4 Aider
Best with specific file scope (`/add <paths>`). Excellent for refactors across 5–10 files (e.g., applying Chapter 27 anti-pattern fixes). Set `model: claude-sonnet-4-5` and `cache-prompts: true`.

### 26.5 Recommended Split
- **Claude Code:** Blocks 0.1–0.6, 1.1–1.2, all domain-heavy modules.
- **Cursor:** Bug-fix loops, polish, tight iteration after scaffolding.
- **Aider:** Bulk refactors (anti-pattern sweeps, migration squashes).
- **Copilot:** Test generation from signed-off blocks.

---

# Part VII — Quality & Safety

## Chapter 27 — Anti-Pattern Library

Specific bad code AI agents generate on exactly this stack. Include in System Rules as negative examples.

### 27.1 Prisma Anti-Patterns

**N+1 explosion:**
```ts
// ❌ BAD
const trips = await prisma.trip.findMany();
for (const trip of trips) {
  const days = await prisma.itineraryDay.findMany({ where: { tripId: trip.id } });
}

// ✅ GOOD
const trips = await prisma.trip.findMany({
  include: { days: { include: { items: true } } }
});
```

**Typing `Unsupported` PostGIS columns directly:**
```ts
// ❌ BAD — silent runtime failure
const place = await prisma.place.create({
  data: { coordinates: 'POINT(77.5 12.9)' }
});

// ✅ GOOD
await geoQueries.insertPlace({ name, lat: 12.9, lng: 77.5, ... });
// $executeRaw under the hood with ST_SetSRID(ST_MakePoint(...), 4326)
```

**Transactions wrapping network calls:**
```ts
// ❌ BAD — holds DB lock during Stripe call
await prisma.$transaction(async (tx) => {
  await tx.trip.create(...);
  await stripeClient.charges.create(...);
  await tx.payment.create(...);
});

// ✅ GOOD — saga pattern with compensating action
const trip = await prisma.trip.create(...);
const charge = await stripeClient.charges.create(...);
await prisma.payment.create({ data: { tripId: trip.id, chargeId: charge.id } });
```

### 27.2 NestJS Anti-Patterns

**Fat controllers:**
```ts
// ❌ BAD
@Post()
async createTrip(@Body() dto) {
  const candidates = await this.placesService.search(...);
  const itinerary = await this.aiService.plan(...);
  return this.prisma.trip.create(...);
}

// ✅ GOOD
@Post()
async createTrip(@Body() dto: CreateTripDto, @CurrentUser() user) {
  return this.generateItineraryUseCase.execute({ ...dto, userId: user.id });
}
```

**Injecting PrismaService into use cases:**
```ts
// ❌ BAD — breaks hex architecture
constructor(private readonly prisma: PrismaService) {}
await this.prisma.trip.create(...);

// ✅ GOOD
constructor(@Inject(TRIP_REPO) private readonly repo: TripRepository) {}
await this.repo.save(trip);
```

### 27.3 Async Anti-Patterns

**Sequential awaits of independent work:**
```ts
// ❌ BAD
const weather = await this.weather.get(loc);
const safety = await this.safety.get(loc);
const events = await this.events.get(loc);

// ✅ GOOD
const [weather, safety, events] = await Promise.all([
  this.weather.get(loc),
  this.safety.get(loc),
  this.events.get(loc),
]);
```

**`Promise.all` for best-effort fanout:**
```ts
// ❌ BAD — one failure kills all
const [a, b, c] = await Promise.all([...]);

// ✅ GOOD
const results = await Promise.allSettled([...]);
const places = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
```

### 27.4 Type Anti-Patterns

```ts
// ❌ BAD
function processTrip(data: any) { ... }
const userId = req.user?.id as string;

// ✅ GOOD
function processTrip(data: Trip) { ... }
const userId = assertDefined(req.user?.id, 'user required after JwtAuthGuard');
```

### 27.5 Security Anti-Patterns

**Logging secrets:**
```ts
// ❌ BAD
logger.info({ body: req.body }, 'received request');

// ✅ GOOD (with redact config from Ch 15.2)
logger.info({ userId, tripId }, 'trip_created');
```

**IDOR:**
```ts
// ❌ BAD — any authenticated user reads any trip
@Get(':id')
async getTrip(@Param('id') id: string) {
  return this.tripRepo.findById(id);
}

// ✅ GOOD
@Get(':id')
async getTrip(@Param('id') id: string, @CurrentUser() user) {
  const trip = await this.tripRepo.findById(id);
  if (!trip.canAccess(user.id)) throw new ForbiddenError();
  return trip;
}
```

### 27.6 React / Next.js Anti-Patterns

**Fetching in useEffect when RSC would do:**
```tsx
// ❌ BAD
'use client';
useEffect(() => { fetch('/api/trips').then(setTrips); }, []);

// ✅ GOOD — RSC
async function TripsPage() {
  const trips = await sdk.trips.list();
  return <TripList trips={trips} />;
}
```

**Storing JWT in localStorage:**
```tsx
// ❌ BAD
localStorage.setItem('token', accessToken);

// ✅ GOOD
// Access token in memory only; refresh token in httpOnly cookie set by API.
// Never touch tokens in client-readable storage.
```

---

## Chapter 28 — In-App AI Prompts

Your highest-risk, highest-cost code. The v1 compendium left this as "Claude plans the itinerary" with no system prompt. Starter kit below.

### 28.1 Itinerary Generator (Sonnet 4.6, ~12k in / 8k out)

```
SYSTEM:
You are the planning engine of TravelSuperApp. You produce day-by-day travel itineraries
from a candidate place list, user preferences, weather forecast, and safety data.

HARD CONSTRAINTS:
1. Every itinerary item MUST reference a place_id from the candidates list. Never invent.
2. Never exceed the user's daily pace: budget=6h active/day, moderate=8h, intense=10h.
3. Never schedule an outdoor activity when forecast shows storm/heavy rain that hour.
4. Every leg between items must be physically feasible in the user's transport mode.
   If not, either swap the order or drop the further item.
5. Respect dietary + accessibility filters strictly. Silent-fail is unacceptable.
6. Safety score < 4/10 places are excluded unless user explicitly allows risky.

OUTPUT: Strict JSON matching ItinerarySchema. No prose. No markdown. No explanations.

SCORING (you optimize):
- variety: no same-category item twice in a row
- pace: start times between 8–10am, breaks every 3h, dinner 7–9pm
- cost: stay within budget_cents total
- distance: minimize per-day km while maximizing score
- weather fit: indoor backups for rainy hours

USER:
<candidates>       ← 50–100 places with { id, name, category, lat, lng, rating, relaxation, safety, openHours }
<preferences>      ← travel type, budget, transport, dietary, accessibility, languages
<forecast>         ← daily weather for trip dates
<dates>            ← start, end
<must_include>     ← array of place_ids
<exclude>          ← array of place_ids

Produce a Trip JSON object.
```

**Prompt caching:** SYSTEM block + schema definitions in cache layer 2 (1h TTL). Only the four `<...>` blobs are fresh per call.

**Self-repair loop:** wrap in a 2-attempt retry where attempt 2 gets attempt 1's Zod validation errors prepended. Success rate goes from ~85% to ~99%.

### 28.2 Re-Planner (Sonnet 4.6, ~8k / 4k)

```
SYSTEM:
You are the re-planning engine. User has a trip in progress. Something changed
(delay, closure, weather, mood). Produce a minimal-diff replacement from the current
point onward. Do NOT rewrite past days or items already completed.

HARD CONSTRAINTS:
1. Preserve all completed items (items[i].completedAt is set).
2. Keep user's original preferences unless re-planning reason explicitly changes them.
3. Minimize surgery — touch the fewest items possible.
4. If a replaced item has a booking (hotel, paid activity), flag it — don't silently drop.

OUTPUT: JSON diff against current Trip — { replace: [{itemId, newItem}], insert: [...], remove: [...] }
```

### 28.3 Translator (NLLB-200 Self-Hosted)
Not a prompt — gRPC to ai-service with `{text, source_lang?, target_lang}`. Auto-detect source if missing (langdetect). Cache by `sha256(text + target)` in Redis, 7-day TTL. Highest-volume feature; caching saves 70%+ cost.

### 28.4 Fake-Review Classifier
Not a prompt — classification head returning `{fake_probability: 0..1, signals: string[]}`. Run on every review at write time. Block if > 0.85, manual queue 0.5–0.85, publish < 0.5. Training data: labeled TripAdvisor + Yelp fake-review datasets (public), fine-tune on 5k hand-labeled after launch.

### 28.5 Scam Detector
Not a one-shot LLM — vector similarity check. Every new place / agent / listing embedded; 10 nearest neighbors in scam embedding space checked. If avg similarity > 0.7 to known scams → flag.

### 28.6 Safety-Bot Chat (Haiku 4.5, ~2k / 0.5k)

```
SYSTEM:
You are the user's on-trip safety assistant. You ONLY answer by calling tools.
Never give medical, legal, or safety advice from your own knowledge.

TOOLS:
- nearest_hospital(lat, lng)
- nearest_embassy(country, lat, lng)
- emergency_numbers(country)
- current_safety_score(lat, lng, timeOfDay)
- scam_check(description)
- translate(text, target_lang)

If user asks anything outside these tools, reply: "I can only help with safety,
emergencies, and translation. For <topic>, please see our help center."
```

Token savings vs general-purpose chat: ~60%. Liability: enormous reduction.

### 28.7 Prompt Caching Budget
```
SYSTEM prompts:          cached (layer 2, 1h)
Schema definitions:      cached (layer 2, 1h)
Candidates block:        NOT cached (user-specific)
User preferences:        NOT cached
Conversation history:    cached (layer 1, 5m) — only for multi-turn chat
```
Apply this and LLM costs drop 60–80%.

---

# Part VIII — Operations & Governance

## Chapter 29 — Analytics Event Taxonomy

Without this, analytics rot within three months and you can't answer basic product questions.

### 29.1 Naming Convention
`<domain>_<action>_<outcome>` — snake_case. Past tense for outcomes. Examples: `trip_generated`, `trip_generation_failed`, `place_viewed`, `booking_initiated`, `booking_completed`.

### 29.2 Core Event Catalog (Phases 0–1)

| Event | When fired | Properties | Owner context |
|---|---|---|---|
| `user_registered` | register use case succeeds | method (email\|google\|apple), referrer | identity |
| `user_logged_in` | login use case succeeds | method, mfa_used | identity |
| `user_login_failed` | login fails | reason (bad_password\|locked\|mfa_wrong) | identity |
| `mfa_enabled` | MFA setup confirmed | — | identity |
| `account_deleted` | self-delete | reason (if given) | identity |
| `trip_draft_started` | generate-itinerary called | radius_km, preferences, candidate_count | trip |
| `trip_generated` | AI plan returned | model, tokens_in, tokens_out, latency_ms, days, items_count | trip |
| `trip_generation_failed` | error in gen | error_code, retry_count | trip |
| `trip_edited` | user edits itinerary | edit_type (add\|remove\|swap\|reorder), item_count | trip |
| `trip_shared` | share code created | share_type (public\|collaborator) | trip |
| `trip_activated` | user starts live trip | days_ahead_of_start | trip |
| `trip_completed` | end_date reached OR user marks done | duration_days, items_completed_pct | trip |
| `replan_requested` | live re-plan | reason, affected_day | trip |
| `place_searched` | search API called | radius_km, category_filter, result_count | places |
| `place_viewed` | place detail opened | place_id, source_list, position_in_list | places |
| `place_added_to_trip` | user adds place | place_id, via (search\|suggestion\|map) | places |
| `stay_viewed` | stay detail opened | stay_id, provider | stays |
| `booking_initiated` | affiliate link clicked | stay_id, provider, deep_link | stays |
| `booking_completed` | webhook OR affiliate postback | amount_cents, commission_cents, provider | payments |
| `weather_alert_sent` | alert push delivered | alert_type, severity | notifications |
| `safety_alert_sent` | crime/scam alert delivered | alert_type, severity, place_id | safety |
| `scam_reported` | user reports scam | scam_type, has_photo | safety |
| `sos_triggered` | SOS button pressed | location, method (hospital\|police\|embassy) | safety |
| `translator_used` | translation call | source_lang, target_lang, text_length, cache_hit | translation |
| `translator_voice_used` | voice input translation | duration_s, lang_pair | translation |
| `offline_pack_downloaded` | offline bundle saved | city, size_mb | offline |
| `push_permission_granted` | user enables push | — | notifications |
| `push_delivered` | FCM/APNs receipt | notification_type | notifications |
| `push_opened` | user taps notification | notification_type, seconds_to_open | notifications |
| `subscription_started` | Stripe sub created | plan, amount_cents, trial | payments |
| `subscription_canceled` | user cancels | plan, days_active, reason (if given) | payments |
| `feature_flag_evaluated` | flag evaluated | flag_name, variant | infra |
| `api_error` | 5xx response | endpoint, error_code, trace_id | infra |
| `slow_query_detected` | query > 200ms | query_name, duration_ms | infra |

### 29.3 Required Properties on Every Event
- `user_id` (null if unauthenticated)
- `session_id`
- `device_id`
- `app_version`
- `platform` (ios\|android\|web)
- `locale`
- `timestamp` (ISO)
- `trace_id` (same as API trace — ties analytics ↔ logs)

### 29.4 Governance
- Every new event added to `packages/analytics/src/events.ts` with a Zod schema.
- PR check: calling `track('foo')` without `foo` existing in the catalog → CI fails.
- Monthly review: drop any event with zero volume for 60 days.

---

## Chapter 30 — Data Governance & Privacy

### 30.1 Retention Schedule

| Entity | Retention | Deletion trigger | PII level |
|---|---|---|---|
| User profile (active) | indefinite | account delete → anonymize | high |
| User profile (deleted) | 30d soft delete then purge | self-service + cron | high |
| Session | 60d past expiry | cron nightly | medium |
| Trip (draft) | 90d idle | cron | low |
| Trip (archived) | indefinite | user delete | low |
| Review | indefinite (no PII) | user delete | low (scan body for PII) |
| Photo / media | tied to trip lifecycle | user delete | medium (EXIF has GPS) |
| Payment record | 7 years (tax / chargeback) | manual/legal only | high |
| Crime / scam data | indefinite (aggregated) | never individually identifying | low |
| Logs | 30d hot, 1y cold | cron | medium (scrubbed) |
| Analytics events | 2y | PostHog rollup | low (hashed user_id) |
| Backups | 35d rolling | automatic | high |

### 30.2 GDPR / DPDP Delete Propagation Flow

```
user → DELETE /users/me
      │
      ▼
  IdentityModule.deleteAccount
      ├─ publish UserDeletedEvent (event bus)
      ▼
  Subscribers anonymize in their context:
    - TripModule:          user_id → NULL, trips marked archived
    - ReviewModule:        author → "Former traveler", body sanitized via LLM
    - MediaModule:         EXIF strip + archive for 30d
    - PaymentModule:       retain record but scrub email/name (legal retention)
    - NotificationLog:     purge
    - AnalyticsPipeline:   user_id replaced with consistent hash (metrics still flow)
  ▼
  30-day grace period (cron marks hard_delete_after_utc)
  ▼
  Hard purge job deletes all remaining rows
  ▼
  Audit log entry retained in separate encrypted log (who deleted, when, what)
```

### 30.3 Data Export (GDPR Art. 20)
`GET /users/me/export` enqueues a job assembling a zip:
- profile.json
- trips.json + itineraries
- reviews.json
- photos/ (originals)
- subscriptions.json
- email summaries
- Signed SHA-256 manifest

Delivered via signed S3 URL, 72h expiry, email notification. Max 1 export / user / 24h.

### 30.4 Consent Framework
- First-launch onboarding: granular consents — analytics, marketing emails, push, personalized ads (placeholder even if unused).
- Every consent recorded: `{userId, purpose, granted, version_of_policy, timestamp, ip}`.
- Consent table is append-only; revocations are new rows.
- On analytics consent revoke → server stops non-essential events for that user ID.

### 30.5 DPA Skeleton (for B2B)
Stock clauses: scope, subprocessors list, TOMs, data-subject rights passthrough, breach notification (< 72h), audit rights (SOC 2 report in lieu of on-site). Stored in `legal/dpa-template.md`.

### 30.6 Public Subprocessor List (at /legal/subprocessors)
Every service touching user data: name, purpose, data categories, region, certifications. Examples: Supabase (DB — EU), Stripe (payments — US/EU), Twilio (SMS — US), Sentry (errors — EU), Resend (email — US), Anthropic (LLM — US), Cloudflare (CDN — global).

---

## Chapter 31 — Disaster Recovery & Incident Response

### 31.1 RPO / RTO Targets (v1)

| Scenario | RPO (data loss) | RTO (downtime) | How |
|---|---|---|---|
| API container crash | 0 | < 60s | Fly.io auto-respawn. |
| DB corrupt / dropped | < 5 min | < 30 min | Supabase PITR (nightly base + WAL). |
| Region outage (Fly) | < 5 min | < 2 h | Multi-region secondary (Phase 2). |
| Ransomware / malicious delete | < 24 h | < 4 h | Backups to separate provider (Backblaze B2). |
| Full account compromise | < 24 h | < 24 h | Rotate every secret; restore last known good. |

### 31.2 Backup Strategy
- **Postgres:** Supabase PITR (7d free, 30d pro) + nightly logical dump → Backblaze B2 (cross-region, cross-provider). Encrypt at rest with age/rage keypair stored in 1Password.
- **Redis:** AOF persist, but treat as cache — no RPO guarantees. Rebuild from Postgres if lost.
- **S3 / R2 (media):** versioning on; cross-region replication to B2 nightly.
- **Secrets:** Doppler snapshots weekly to encrypted offline vault.

### 31.3 Severity Matrix

| Sev | Definition | Response time | Example |
|---|---|---|---|
| 1 | Prod down; users can't log in | 15 min | API 5xx > 50%. |
| 2 | Major feature down; revenue impact | 1 h | Stripe webhooks failing. |
| 3 | Minor feature; some users affected | 4 h | Translator failing for one language. |
| 4 | Cosmetic / non-urgent | 1 week | Spelling error. |

### 31.4 Runbooks Index (each 1-page in `docs/runbooks/`)
- `runbook-db-cpu-high.md`
- `runbook-redis-eviction.md`
- `runbook-api-5xx-spike.md`
- `runbook-stripe-webhook-backlog.md`
- `runbook-push-delivery-failure.md`
- `runbook-ai-service-down.md` (graceful degradation: cache last itinerary, template fallback)
- `runbook-data-breach-response.md` (legal flow, regulator notification, customer notice templates)
- `runbook-account-takeover.md`

### 31.5 Postmortem Template
`docs/postmortems/YYYY-MM-DD-<incident>.md` — blameless:
1. Impact (users, duration, revenue).
2. Timeline (exact UTC).
3. Root cause.
4. Detection (how did we know?).
5. Response (what we did).
6. What went well.
7. What didn't.
8. Action items (owner + due + Linear ticket).

Post within 5 business days. Public-facing summary for Sev 1–2.

---

# Part IX — DevOps

## Chapter 32 — Local Development

### 32.1 One-Command Setup
```bash
pnpm i && docker compose up -d && pnpm db:migrate && pnpm dev
```

### 32.2 Docker Compose Stack
Runs: Postgres + PostGIS + pgvector, Redis, Meilisearch, MinIO (S3), Mailpit (email), Jaeger (tracing), Prometheus, Grafana.

Health checks on every service. All containers heathy within 60 seconds of `docker compose up -d`.

### 32.3 Makefile Targets
- `make up` / `make down` / `make logs` / `make reset`
- `make db-shell` — psql into Postgres
- `make redis-shell` — redis-cli into Redis

### 32.4 Environment Variables
Zod-validated (Chapter 11.1). Local `.env.local` (gitignored); prod via Doppler.

---

## Chapter 33 — CI/CD

### 33.1 Pipeline Architecture

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | every PR | lint → typecheck → unit → integration (matrix by app) → build — all parallel via Turbo. |
| `security.yml` | every PR + nightly | gitleaks, Trivy (images + fs), pnpm audit, CodeQL, Semgrep. |
| `cd.yml` | main merge | build+push images to GHCR → deploy api→Fly.io, web/admin→Vercel, mobile→EAS OTA. |
| `preview.yml` | every PR | Fly preview app + Vercel preview + Expo preview build. |
| `release.yml` | tag | changesets → semver → GH release → mobile store submission (manual gate). |

### 33.2 Caching
Turborepo remote cache (Vercel or self-hosted) — reduces CI time 70%+ on subsequent runs.

### 33.3 Environments
`local → preview (per-PR) → staging (main) → production (tagged)`. Migrations via `prisma migrate deploy` in a pre-deploy job with shadow DB diff check.

---

## Chapter 34 — Deployment

### 34.1 Multi-Stage Distroless Dockerfile
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

### 34.2 Hosting (v1)
- **API** → Fly.io (or Railway)
- **Web / Admin** → Vercel
- **Mobile** → EAS Build + OTA updates
- **Infra** → Terraform-ready for AWS ECS/EKS when time comes

### 34.3 When to Move to Kubernetes
Skip for v1. Fly.io / Railway scale to ~100k MAU. Move to EKS/GKE only when: >3 regions needed, custom networking, dedicated GPU pools for self-hosted LLMs. Helm charts already scaffolded in `/infra/k8s` → deploy swap, not rewrite.

---

# Part X — Roadmap & Delivery

## Chapter 35 — Phased Roadmap

| Phase | Duration | Scope | Exit criteria |
|---|---|---|---|
| **0 — Foundation** | Weeks 1–4 | Monorepo, CI/CD, Docker, Nest skeleton, Next.js + Expo skeletons, auth module, logging, tracing, CI green | One-command local up, PR template, identity working end-to-end on all 3 clients. |
| **1 — Core MVP** | Months 2–5 | Trip, Places, Stays, Food, Transport, Weather, Translation, Offline pack, Notifications, Payments (affiliate). Ship to stores. | 500 beta users, crash-free > 99.5%, p95 < 500 ms. |
| **2 — Safety & Live** | Months 6–8 | Crime + scam + SOS + agents, Live (geofence + re-plan), Events, Social (groups + expenses), Freemium live | Premium conv > 3%, SOS tested in 3 cities. |
| **3 — Wow Layer** | Months 9–12 | 3D previews, animated map, crowd analytics, photo templates, price aggregator, fake-review ML, memory book, public templates | MAU 50k, B2B pilot signed. |
| **4 — Polish & Scale** | Month 12+ | Gamification, carbon, live guide video, fine-tuned Llama, multi-region, SOC 2 readiness | Profitability path visible. |

---

## Chapter 36 — Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Node bad fit for heavy ML | Python ai-service isolated; Node only orchestrates. |
| LLM cost explosion | Aggressive caching (Ch 21.2, 22.2) + Haiku routing + fine-tune later. |
| Scope creep | Strict phase gates; each phase shippable independently. |
| Data moat slow | Seed 5 launch cities with OSM + licensed data; gamified reviews. |
| Local agent fraud | KYC (Sumsub/Persona) + Stripe Connect escrow + karma weighting + two-sided reviews. |
| Monolith → microservice pain later | Strict module boundaries, ports/adapters, events now = painless extraction. |
| Legal (crime data, PII, satellite ToS) | Counsel review before Phase 2; GDPR + DPDP compliant day one; DPIA recorded. |
| Battery drain (live mode) | Geofencing > polling; adaptive intervals; OS-specific background allowances. |
| Vendor lock-in | Every external dep behind a port/adapter; ORM abstracts DB. |
| AI hallucinations on real places | RAG-everything; never generate place name without citation. |
| Map/3D/satellite API costs | Aggressive caching (Redis + R2); tile pre-fetch for popular cities. |
| Fake reviews poisoning graph | DistilBERT classifier + manual queue + karma-weighted trust. |

---

## Chapter 37 — Immediate Next Steps (First 2 Weeks)

1. Approve the plan → create GitHub org + monorepo skeleton.
2. Initialize Turborepo (apps/api, web, mobile, ai-service; packages/shared-types, ui, sdk).
3. Stand up Docker Compose stack (Postgres+PostGIS+pgvector, Redis, Meilisearch, MinIO, Mailpit, Jaeger, Prometheus, Grafana).
4. Identity module end-to-end (JWT + OAuth Google/Apple + MFA) with tests + OpenAPI + SDK gen.
5. CI pipeline green (lint, typecheck, unit, integration, security scans, preview deploys).
6. ADR-001 "Modular monolith with extracted ML/worker services" committed.
7. Figma design system + 3 hero screens (itinerary, map, safety).
8. Pick 3–5 launch cities; start OSM data ingestion pipeline for Phase 1 seed.

---

## Chapter 38 — Verification Plan

### 38.1 Per PR
Lint + typecheck + unit + integration + security scans + preview deploy all green.

### 38.2 Per Phase
Full E2E (Maestro + Playwright), load test (k6 @ 10× expected RPS), security review (OWASP checklist), closed beta 50–200 users, manual trip test in a target city.

### 38.3 Pre-Launch
Third-party pen test (API + mobile); DPIA sign-off; store review preparation.

### 38.4 Post-Launch
SLOs tracked in Grafana; weekly error-budget review; monthly chaos test.

---

## Chapter 39 — What To Do Next (Action Menu)

Pick ONE:

1. **Apply all Chapter 17 fixes inline** — I patch the v1 Compendium blocks 0.1–1.2 with every bug fix + Chapter 27 anti-patterns.
2. **Draft Block 0.0 (System Rules)** — full meta-layer preamble from Chapter 19, ready to prepend.
3. **Draft the missing Phase 0 blocks (0.7–0.18)** — v1 format, ready to feed.
4. **Draft the missing Phase 1 blocks (1.3–1.13)** — same.
5. **Draft the AI product prompts (Chapter 28 expanded)** — full system prompts + few-shot examples + Zod output schemas.
6. **Draft the analytics events catalog as `packages/analytics` code** — TypeScript Zod schemas.
7. **Draft the DR runbooks (Chapter 31)** — all 8 runbooks as separate markdown files.
8. **Draft CLAUDE.md, .cursorrules, .aider.conf** — one file per tool so every agent obeys the same rules.
9. **Rewrite the full compendium v2** — single replacement file, all fixes + additions applied.

No code execution until you pick.

---

# Appendices

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| **ADR** | Architecture Decision Record (MADR format). |
| **ARPU** | Average revenue per user. |
| **BCP-47** | Standard for language tags (`en-US`, `hi-IN`). |
| **Bounded context** | DDD concept: a model boundary with its own language and rules. |
| **CASL** | JS library for declarative RBAC. |
| **COGS** | Cost of goods sold (here: infra + LLM + API cost per user). |
| **DAG** | Directed acyclic graph (here: dependencies between blocks). |
| **DLQ** | Dead-letter queue. |
| **DPA** | Data Processing Agreement. |
| **DPDP** | India's Digital Personal Data Protection Act. |
| **DPIA** | Data Protection Impact Assessment (GDPR). |
| **EAS** | Expo Application Services (RN build + OTA). |
| **GDPR** | EU data protection regulation. |
| **Hex architecture** | Ports + adapters; domain at center, infra at edges. |
| **IDOR** | Insecure Direct Object Reference (auth vuln). |
| **JWKS** | JSON Web Key Set — public keys for JWT verification. |
| **LoRA** | Low-Rank Adaptation — efficient LLM fine-tuning. |
| **MADR** | Markdown ADR format. |
| **MAU** | Monthly Active User. |
| **NLLB** | Meta's No Language Left Behind — 200-language translation model. |
| **PITR** | Point-in-Time Recovery (DB). |
| **PMF** | Product-Market Fit. |
| **PostGIS** | Postgres geographic extension. |
| **pgvector** | Postgres extension for vector similarity. |
| **RED metrics** | Rate, Errors, Duration — core service metrics. |
| **RPO / RTO** | Recovery Point / Time Objective. |
| **RSC** | React Server Components. |
| **Saga** | Distributed transaction pattern with compensations. |
| **SLO** | Service Level Objective. |
| **TOMs** | Technical and Organizational Measures (GDPR). |
| **TOTP** | Time-based One-Time Password (MFA). |
| **Turborepo** | Monorepo orchestrator with remote caching. |
| **Use case** | Application-layer command/query handler. |
| **WAL** | Write-Ahead Log (Postgres durability). |
| **WCAG** | Web Content Accessibility Guidelines. |

---

## Appendix B — Reference Stack Summary

**Mobile**: React Native + Expo 51 · expo-router · Tamagui · MMKV · WatermelonDB · Sentry
**Web**: Next.js 15 · App Router + RSC · shadcn/ui + Tailwind · next-intl · PostHog · Sentry
**Admin**: Next.js 15 with RBAC + audit logging
**Backend**: NestJS 11 · Fastify adapter · TypeScript strict · Passport (JWT + OAuth + MFA) · Helmet · CSP
**DB**: PostgreSQL 16 + PostGIS + pgvector + pg_trgm + pgcrypto
**ORM**: Prisma 5 + raw SQL wrapper for geo
**Cache/Queue**: Redis 7 + BullMQ + Redis Streams
**Search**: Meilisearch
**AI (in-app)**: Claude Sonnet 4.6 + Haiku 4.5 + Llama 3.1 (Ollama) + NLLB-200 + Whisper + DistilBERT
**Maps**: Mapbox GL + Google Photorealistic 3D Tiles + Cesium
**Places**: Google Places + Foursquare + OSM Overpass (federated)
**Weather**: Open-Meteo
**Hotels**: Booking.com Affiliate + Amadeus
**Payments**: Stripe (+ Connect for escrow)
**Comms**: Resend + Twilio + Expo/FCM/APNs
**Storage**: Cloudflare R2 / S3 (MinIO locally)
**CDN/WAF**: Cloudflare
**Secrets**: Doppler
**Observability**: OpenTelemetry + Grafana Cloud + Loki + Tempo + Sentry + PostHog
**Testing**: Jest + Supertest + Testcontainers + Playwright + Maestro + k6 + Pact + fast-check
**CI/CD**: GitHub Actions + Turborepo remote cache + Docker Buildx + Trivy
**Infra (v1)**: Fly.io (api) + Vercel (web/admin) + EAS (mobile) + Supabase (DB) + Upstash (Redis)
**Package mgr**: pnpm + Turborepo

---

## Appendix C — Document Mapping (v1 / v2 / v3 → This Book)

| Original section | Source file | Chapter |
|---|---|---|
| Plan §0 Context | travel-app-plan.md | Ch 1 |
| Plan §2 Idea rating | travel-app-plan.md | Ch 2 |
| Plan §3 Feature catalog (from user brainstorm) | (implicit in plan + v1 compendium) | Ch 3.1–3.3 |
| v1 Missing features M1–M18 | travel-app-plan.md | Ch 3.4 |
| Plan §8 Monetization | travel-app-plan.md | Ch 4 |
| Plan §9 UI/UX | travel-app-plan.md | Ch 5 |
| Plan §1, §4 Best approach + architecture diagram | travel-app-plan.md | Ch 6 |
| Plan §3 Domain decomposition | travel-app-plan.md | Ch 7 |
| Plan §5 Tech stack | travel-app-plan.md | Ch 8 |
| Plan §6 Clean architecture | travel-app-plan.md | Ch 9 |
| Plan §7 Folder structure | travel-app-plan.md | Ch 10 |
| Plan §8 Code patterns | travel-app-plan.md | Ch 11 |
| Plan §8.5 Prisma schema | travel-app-plan.md | Ch 12 |
| Plan §9 Security | travel-app-plan.md | Ch 13 |
| Plan §10 Testing | travel-app-plan.md | Ch 14 |
| Plan §11 Observability | travel-app-plan.md | Ch 15 |
| v2 Part A Feasibility verdict | travel-app-compendium-v2.md | Ch 16 |
| v2 Part B Bugs in v1 | travel-app-compendium-v2.md | Ch 17 |
| v2 Part C Missing blocks | travel-app-compendium-v2.md | Ch 18 |
| v2 Part D Meta-layer upgrades | travel-app-compendium-v2.md | Ch 19 |
| v2 Part E Suggested TOC | travel-app-compendium-v2.md | Ch 20 |
| v2 Part F Timeline | travel-app-compendium-v2.md | Ch 16.3 |
| v3 Part H Token economics | travel-app-compendium-v3.md | Ch 21 |
| v3 Part P Unit economics | travel-app-compendium-v3.md | Ch 22 + 23 |
| v3 Part I Block lifecycle | travel-app-compendium-v3.md | Ch 24 |
| v3 Part K DAG | travel-app-compendium-v3.md | Ch 25 |
| v3 Part Q Agent tools | travel-app-compendium-v3.md | Ch 26 |
| v3 Part J Anti-patterns | travel-app-compendium-v3.md | Ch 27 |
| v3 Part L In-app AI prompts | travel-app-compendium-v3.md | Ch 28 |
| v3 Part M Analytics taxonomy | travel-app-compendium-v3.md | Ch 29 |
| v3 Part N Data governance | travel-app-compendium-v3.md | Ch 30 |
| v3 Part O DR + incident response | travel-app-compendium-v3.md | Ch 31 |
| Plan §12 DevOps | travel-app-plan.md | Ch 32–34 |
| Plan §15 Phased roadmap | travel-app-plan.md | Ch 35 |
| Plan §16 Risks | travel-app-plan.md | Ch 36 |
| Plan §17 Immediate next steps | travel-app-plan.md | Ch 37 |
| Plan §18 Verification | travel-app-plan.md | Ch 38 |
| v2 Part G + v3 Part R action menus | — (merged) | Ch 39 |

---

*End of book.*
