# Inputs to the Fly stack ([N3]).
#
# All sensitive values default to `null` so a `terraform plan` without
# secrets shows the SHAPE of the diff without leaking anything. CI
# passes them via `-var-file=…` from a Doppler-pulled file (see
# `docs/runbooks/secrets.md`).

variable "fly_organization" {
  description = "Fly.io org slug that owns the apps."
  type        = string
}

variable "environment" {
  description = "Which environment to provision: staging | production."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "primary_region" {
  description = "Fly region (3-letter code) the api primary runs in."
  type        = string
  default     = "iad"
}

variable "regions" {
  description = "All regions the api may scale into."
  type        = list(string)
  default     = ["iad"]
}

variable "min_machines_running" {
  description = "Minimum live machines. staging defaults to 1, prod to 2."
  type        = number
  default     = null # filled by locals based on environment
}

variable "vm_size" {
  description = "Fly VM preset (e.g. shared-cpu-1x, shared-cpu-2x, performance-1x)."
  type        = string
  default     = null
}

variable "vm_memory_mb" {
  description = "VM memory in MB."
  type        = number
  default     = null
}

# ─── Secrets (passed by CI; `null` for plan-only flows) ───────────────

variable "database_url" {
  description = "Postgres connection string (Supabase pooler URL)."
  type        = string
  sensitive   = true
  default     = null
}

variable "direct_url" {
  description = "Direct (non-pooled) Postgres URL; Prisma uses this for migrations."
  type        = string
  sensitive   = true
  default     = null
}

variable "redis_url" {
  description = "Redis connection string (Upstash or self-hosted)."
  type        = string
  sensitive   = true
  default     = null
}

variable "jwt_access_secret" {
  description = "HMAC secret for access tokens; rotate via JWT keyring."
  type        = string
  sensitive   = true
  default     = null
}

variable "jwt_refresh_secret" {
  description = "HMAC secret for refresh tokens; rotate via JWT keyring."
  type        = string
  sensitive   = true
  default     = null
}

variable "rate_limit_pepper" {
  description = "Per-env pepper for hashing identifiers in Redis rate-limit keys."
  type        = string
  sensitive   = true
  default     = null
}

variable "email_pepper" {
  description = "Per-env pepper for hashing emails in the user index."
  type        = string
  sensitive   = true
  default     = null
}

variable "honeycomb_api_key" {
  description = "Honeycomb ingest key. Empty → OTel SDK skips startup ([N1])."
  type        = string
  sensitive   = true
  default     = null
}

variable "sentry_dsn_api" {
  description = "Sentry DSN for the api project. Empty → Sentry init is a no-op."
  type        = string
  sensitive   = true
  default     = null
}

# ─── Computed defaults ─────────────────────────────────────────────────

locals {
  # Naming convention from `fly.toml`: travel-api-{staging,prod}.
  # Prod uses `-prod` (not `-production`) to match the existing
  # historical app name.
  app_name = "travel-api-${var.environment == "production" ? "prod" : "staging"}"

  min_machines = coalesce(
    var.min_machines_running,
    var.environment == "production" ? 2 : 1,
  )

  vm_size = coalesce(
    var.vm_size,
    var.environment == "production" ? "shared-cpu-2x" : "shared-cpu-1x",
  )

  vm_memory = coalesce(
    var.vm_memory_mb,
    var.environment == "production" ? 2048 : 1024,
  )

  # Secrets that get set unconditionally — `for_each` iterates this map
  # and runs `fly_app_secrets` once per pair. Keys MUST match what
  # `apps/api/src` reads from `process.env` (i.e. `Env` from
  # `@app/config`). Null values are filtered below.
  secrets_all = {
    DATABASE_URL       = var.database_url
    DIRECT_URL         = var.direct_url
    REDIS_URL          = var.redis_url
    JWT_ACCESS_SECRET  = var.jwt_access_secret
    JWT_REFRESH_SECRET = var.jwt_refresh_secret
    RATE_LIMIT_PEPPER  = var.rate_limit_pepper
    EMAIL_PEPPER       = var.email_pepper
    HONEYCOMB_API_KEY  = var.honeycomb_api_key
    SENTRY_DSN_API     = var.sentry_dsn_api
  }

  # Drop keys whose value is null — Terraform passes the rest to
  # `fly_app_secrets` so an operator can `terraform apply` with a
  # partial secret bundle (e.g., rotate ONLY the JWT secret without
  # re-sending DATABASE_URL).
  secrets = {
    for k, v in local.secrets_all : k => v if v != null
  }
}
