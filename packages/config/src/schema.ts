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
const DatabaseSchema = z.object({
  DATABASE_URL: z.string().url(),
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

// ─── AI (Anthropic primary; OpenAI fallback; Python ai-service sidecar) ─
const AiSchema = z.object({
  CLAUDE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8001'),
});

// ─── Stripe (subs + Connect escrow + webhooks) ──────────────────────────
const StripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
});

// ─── External place / map / booking APIs ────────────────────────────────
const ExternalApisSchema = z.object({
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  FOURSQUARE_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
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
});

// ─── Meilisearch (typo-tolerant full-text) ──────────────────────────────
const MeiliSchema = z.object({
  MEILI_HOST: z.string().url().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().min(16),
});

// ─── Observability ──────────────────────────────────────────────────────
const ObservabilitySchema = z.object({
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_API_KEY: z.string().optional(),
});

// ─── Feature flags (OpenFeature local fallback) ─────────────────────────
const FeaturesSchema = z.object({
  FEATURE_3D_ENABLED: z.coerce.boolean().default(false),
  FEATURE_SATELLITE_CROWD: z.coerce.boolean().default(false),
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
  .merge(SecuritySchema);

/** Fully-typed, validated environment. */
export type Env = z.infer<typeof EnvSchema>;
