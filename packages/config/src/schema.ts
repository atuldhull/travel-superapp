/**
 * Typed, Zod-validated environment schema for TravelSuperApp.
 *
 * Grouping matches how variables flow in the architecture:
 *   runtime · database · redis · jwt · oauth · ai · stripe · external-apis ·
 *   storage · comms · meili · observability · features · security.
 *
 * Playbook §11.1. Installed by prompt [III.11.1].
 *
 * ─── Authoring rules ────────────────────────────────────────────────────
 *   1. Required vars have no default and no .optional().
 *   2. "Dev-friendly" defaults are only used where a sensible local value
 *      exists (PORT, LOG_LEVEL, JWT expiries, AI_SERVICE_URL, MEILI_HOST,
 *      feature flags). Never default secrets.
 *   3. URLs use z.string().url() to catch typos early.
 *   4. Numeric env vars use z.coerce.number() — process.env values are
 *      always strings.
 *   5. Feature flags are boolean via z.coerce.boolean() (accepts "true"/"1"/…).
 */
import { z } from 'zod';

// ─── Runtime ────────────────────────────────────────────────────────────
const RuntimeSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Must stay in sync with `LogLevel` in @app/logger/src/logger.ts.
  LOG_LEVEL: z.enum(['silent', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// ─── Database (Postgres 16 + PostGIS + pgvector) ────────────────────────
//
// Two URLs by design ([Q1] scale-readiness):
//   - DATABASE_URL → goes through PgBouncer (transaction-mode) in
//     staging / prod. Pooled — handles 1000s of clients on top of a
//     small (10-25) physical connection pool. Per Prisma docs, the
//     pooled URL MUST carry `?pgbouncer=true&connection_limit=1` so
//     the client disables prepared statements (which break under
//     transaction-mode pooling) and keeps one connection per worker.
//   - DIRECT_URL → bypasses the pooler (port 5432 vs 6543). Used by
//     `prisma migrate` (DDL needs a session-mode connection) and by
//     Prisma's introspection (advisory locks via session state).
//     Optional — falls back to DATABASE_URL in dev when no pooler.
const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  // [R4] Read replica URL. When set, PrismaService.$readReplica()
  // returns a SECOND PrismaClient connected to this URL — used by
  // explicitly-marked use-cases for hot reads that don't need
  // read-after-write consistency. When unset, $readReplica()
  // returns the primary client (same shape, no branching at call
  // sites). Supabase Team / managed-replica DB URL goes here.
  DATABASE_URL_READONLY: z.string().url().optional(),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

// ─── Redis 7 (cache · rate limits · sessions · streams) ─────────────────
const RedisSchema = z.object({
  REDIS_URL: z.string().url(),
});

// ─── JWT + refresh + JWKS key rotation ──────────────────────────────────
const JwtSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
});

// ─── OAuth2 providers (optional — app boots without them) ───────────────
const GoogleOAuthSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});
const AppleOAuthSchema = z.object({
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
});

// ─── AI / LLM providers (POST.4 — 4-tier fallback chain) ────────────────
//
// The TripPlannerPort factory in `apps/api/src/modules/trip/trip.module.ts`
// resolves providers in priority order at boot:
//   1. Anthropic Claude   — if ANTHROPIC_API_KEY set (paid, premium quality)
//   2. Google Gemini Flash — if GEMINI_API_KEY set (free tier, 1500 req/day)
//   3. Ollama (local)     — if OLLAMA_URL set (truly $0, runs on user's box)
//   4. Stub               — always works (deterministic prose)
//
// Adding a key never breaks anything — strictly additive.
//
// `AI_SERVICE_URL` points at the Python FastAPI sidecar for embeddings /
// vision tasks the Node API doesn't own (Playbook §6).
const AiSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-7'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  OLLAMA_URL: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v))
    .pipe(z.string().url().optional()),
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),
  // POST.2C.2 — embeddings model for the local Ollama embeddings
  // endpoint (POST {OLLAMA_URL}/api/embeddings). DISTINCT from
  // OLLAMA_MODEL (the CHAT model, default llama3.1:8b).
  // `mxbai-embed-large` emits exactly 1024 dims to match
  // PlaceEmbedding / TripPublication.embedding. No key, $0, local.
  EMBEDDING_MODEL: z.string().default('mxbai-embed-large'),
  OPENAI_API_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8001'),
});

// ─── Stripe (POST.9 — Premium subs; Connect escrow lands later) ────────
//
// TEST mode is free for development forever. Get keys at
// https://dashboard.stripe.com (no card required for signup, no charges
// until you swap to LIVE keys). The PaymentsModule factory follows the
// same env-gated pattern as POST.3/4 — when STRIPE_SECRET_KEY is absent,
// the /payments/checkout route returns 503 SERVICE_UNAVAILABLE and the
// /pricing CTA falls back to "coming soon".
const StripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Stripe Price id for the recurring Premium tier ($9 / mo).
   *  Required only when STRIPE_SECRET_KEY is set. */
  STRIPE_PRICE_PREMIUM: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
});

// ─── External place / map / booking APIs ────────────────────────────────
//
// Live-navigation feature (user-directed, $0 base):
//   - OSRM_BASE_URL: real road routing + alternatives. Defaults to
//     the free public demo server (no key, fair-use). Self-host or
//     point at a paid OSRM for production volume.
//   - TOMTOM_API_KEY: optional live traffic flow. When absent the
//     TrafficProvider uses the deterministic mock and the client
//     labels routes "estimated" instead of "live" (same env-gated
//     optional-provider pattern as POST.3/4/9 — adding the key never
//     breaks anything).
const ExternalApisSchema = z.object({
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  FOURSQUARE_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  TOMTOM_API_KEY: z.string().optional(),
});

// ─── S3-compatible object storage (R2 prod · MinIO local) ───────────────
const StorageSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().default('us-east-1'),
});

// ─── Email / SMS / Push ─────────────────────────────────────────────────
const CommsSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  /**
   * V.UX.26 — VAPID keys for the Web Push protocol. When all three are
   * present, the WebPushDispatcher pushes payloads to subscribed
   * browsers. When absent, the dispatcher no-ops (logs only) so dev
   * + tests work without provisioning real keys.
   *
   * Generate with: `npx web-push generate-vapid-keys`.
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:no-reply@travel.local'),
  /**
   * Public web base URL — used to build email links (magic-link, password
   * reset, etc.). Defaults to the local Next.js dev origin so the stub
   * mailer URL works out of the box. In staging/prod, set to the canonical
   * https origin.
   *
   * Installed by prompt [V.UX.2].
   */
  WEB_BASE_URL: z.string().url().default('http://localhost:3001'),
  /** Display "from" name for transactional email. */
  EMAIL_FROM_NAME: z.string().default('TravelSuperApp'),
  /** Address used as the From: header. Stub mailer logs it; real provider
   *  must use a verified-sender address. */
  EMAIL_FROM_ADDRESS: z.string().default('no-reply@travel.local'),
});

// ─── Meilisearch (typo-tolerant full-text) ──────────────────────────────
const MeiliSchema = z.object({
  MEILI_HOST: z.string().url().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().min(16),
});

// ─── Observability (POST.10 — Sentry + Honeycomb, all optional) ────────
//
// Activation pattern (mirrors POST.3/4/9): missing key = no-op,
// existing logs/health-checks keep working. Set the appropriate
// var and restart to wire telemetry.
//
//   - SENTRY_DSN_API:   apps/api uncaught errors → Sentry
//   - SENTRY_DSN_WEB:   apps/web client + SSR errors → Sentry
//   - HONEYCOMB_API_KEY: OTel traces → api.honeycomb.io (replaces
//     the default Jaeger/Tempo endpoint that's pointed nowhere in
//     local dev and was logging OTLPExporterError 404 every boot).
//
// `SENTRY_DSN` (legacy single-var) is kept for backwards compat
// but new code reads SENTRY_DSN_API explicitly.
// `optionalUrl` accepts a valid URL OR an empty string OR undefined.
// Empty string maps to undefined so the rest of the app sees a clean
// "not configured" signal. Required because dev-bootstrap-generated
// `.env` files declare every var with `KEY=` (empty value) — a plain
// `z.string().url().optional()` would reject the empty string and
// fail-fast at boot.
const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : v))
  .pipe(z.string().url().optional());

const ObservabilitySchema = z.object({
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  SENTRY_DSN: optionalUrl,
  SENTRY_DSN_API: optionalUrl,
  SENTRY_DSN_WEB: optionalUrl,
  HONEYCOMB_API_KEY: z.string().optional(),
  /** Honeycomb dataset name (defaults to NODE_ENV). */
  HONEYCOMB_DATASET: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

// ─── Feature flags (OpenFeature local fallback) ─────────────────────────
const FeaturesSchema = z.object({
  FEATURE_3D_ENABLED: z.coerce.boolean().default(false),
  FEATURE_SATELLITE_CROWD: z.coerce.boolean().default(false),
  // POST.2A.1 — gates the 2.0 trip-agent (Track A). Default off:
  // the AgentModule is always imported but inert until this is set,
  // mirroring the PaymentsModule env-gated pattern.
  FEATURE_AGENT_ENABLED: z.coerce.boolean().default(false),
});

// ─── 2.0 Agent loop (POST.2A.3 — both optional, free, $0) ───────────────
// OpenSky anonymous tier (no key). Tick is a setInterval (ms) — there
// is no cron-string infra in this codebase.
const AgentSchema = z.object({
  OPENSKY_BASE_URL: z.string().url().default('https://opensky-network.org/api'),
  AGENT_TICK_INTERVAL_MS: z.coerce.number().int().positive().default(900_000),
});

// ─── Security (peppers, keys, HTTP perimeter) ───────────────────────────
const SecuritySchema = z.object({
  RATE_LIMIT_PEPPER: z.string().min(32),
  /**
   * Shared pepper for email / IP hashes (Playbook §13.11, §13.4). Stored
   * as sha256(pepper + value), never plaintext. Rotate with a multi-phase
   * migration — adding the new pepper, dual-write, backfill, retire.
   */
  EMAIL_PEPPER: z.string().min(32),
  /**
   * Pepper for sha256-hashed MFA backup codes. Codes are returned
   * once at generation and looked up by hash on redemption. Rotating
   * the pepper invalidates every outstanding backup code — plan a
   * re-generation flow when rotating.
   */
  BACKUP_CODE_PEPPER: z.string().min(32),
  /**
   * Comma-separated CORS allow-list of exact origins (scheme + host + port).
   * Empty / absent means "no cross-origin requests permitted" — the safe
   * default. Wildcards are intentionally not supported: if you want "any
   * origin" in dev, list the dev origins explicitly. [IV.18.1.17]
   */
  CORS_ORIGINS: z.string().default(''),
});

// ─── Composed root schema ───────────────────────────────────────────────
export const EnvSchema = RuntimeSchema.merge(DatabaseSchema)
  .merge(RedisSchema)
  .merge(JwtSchema)
  .merge(GoogleOAuthSchema)
  .merge(AppleOAuthSchema)
  .merge(AiSchema)
  .merge(StripeSchema)
  .merge(ExternalApisSchema)
  .merge(StorageSchema)
  .merge(CommsSchema)
  .merge(MeiliSchema)
  .merge(ObservabilitySchema)
  .merge(FeaturesSchema)
  .merge(AgentSchema)
  .merge(SecuritySchema);

/** Fully-typed, validated environment. */
export type Env = z.infer<typeof EnvSchema>;
