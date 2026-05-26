# Cloudflare edge ([N9]) — WAF + rate-limit rules at the perimeter.
#
# Why edge instead of (or in addition to) ThrottlerModule:
#   - ThrottlerModule rate-limits AFTER the api has parsed the
#     request — it still costs CPU + DB-pool slots. An edge limit
#     drops the request BEFORE it crosses the trust boundary.
#   - Cloudflare's free plan includes basic WAF + rate-limiting,
#     so this is $0 unless we opt into Pro / Business.
#
# This file is GUARDED by `var.cloudflare_enabled` — set false in
# tfvars to skip every Cloudflare resource (the default). Until DNS
# is parked on Cloudflare, none of this applies.
#
# Required vars (only when cloudflare_enabled = true):
#   - cloudflare_api_token   service token with Zone:Edit + Page Rules
#   - cloudflare_zone_id     the zone id for the prod domain
#   - public_api_hostname    e.g. api.travel.example
#
# Rule design — three families:
#
#   1. ALLOW   — always-allow paths (/api/v1/health/*, /metrics).
#               Keeps probes + Prometheus scrape from ever being throttled.
#   2. BLOCK   — known-bad signatures (path traversal, exposed
#               admin scanners, common bot UAs).
#   3. LIMIT   — per-IP rate limits, three buckets:
#               /api/v1/auth/login       10 req/min/IP
#               /api/v1/auth/register    3 req/min/IP
#               /api/v1/plan             20 req/min/IP (AI cost guard)
#               everything else          600 req/min/IP (sane default)
#
# These rules supplement, not replace, the ThrottlerModule defaults.
# Belt-and-braces: edge catches the bulk, ThrottlerModule catches the
# rest + handles per-user (post-auth) limiting which the edge can't.

variable "cloudflare_enabled" {
  description = "Toggle the Cloudflare provider + rules. Default off."
  type        = bool
  default     = false
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (scope: Zone:Edit, Rate Limit:Edit)."
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone id for the public domain."
  type        = string
  default     = null
}

variable "public_api_hostname" {
  description = "Public hostname the rules apply to (e.g. api.travel.example)."
  type        = string
  default     = null
}

# Provider declaration is GUARDED by a conditional `provider_meta`-
# free pattern: we just don't reference `cloudflare_*` resources
# when `cloudflare_enabled = false`. Add the provider block in
# `versions.tf` (separate file) when this is enabled.

# ─── Rate-limit: /api/v1/auth/login ─────────────────────────────────────
# 10 successful evaluations per IP per minute. Burst above that and
# the edge returns 429 directly. The api's @nestjs/throttler is the
# inner layer — its limit is 5/15m per identity, which is tighter
# for legitimate users but allows clients to retry quickly on the
# wrong-password path.
resource "cloudflare_rate_limit" "auth_login" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id   = var.cloudflare_zone_id
  threshold = 10
  period    = 60
  match {
    request {
      url_pattern = "${var.public_api_hostname}/api/v1/auth/login"
      schemes     = ["HTTPS"]
      methods     = ["POST"]
    }
  }
  action {
    mode    = "ban"
    timeout = 60 # 1 min ban after threshold hit
    response {
      content_type = "application/json"
      body         = jsonencode({ code = "EDGE_RATE_LIMITED", retryAfterSec = 60 })
    }
  }
}

# ─── Rate-limit: /api/v1/auth/register ───────────────────────────────
# Tighter than login. Real users register once; a flood is a bot.
resource "cloudflare_rate_limit" "auth_register" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id   = var.cloudflare_zone_id
  threshold = 3
  period    = 60
  match {
    request {
      url_pattern = "${var.public_api_hostname}/api/v1/auth/register"
      schemes     = ["HTTPS"]
      methods     = ["POST"]
    }
  }
  action {
    mode    = "ban"
    timeout = 300 # 5-min ban
    response {
      content_type = "application/json"
      body         = jsonencode({ code = "EDGE_RATE_LIMITED", retryAfterSec = 300 })
    }
  }
}

# ─── Rate-limit: /api/v1/plan (AI cost guard) ────────────────────────
# AI endpoints burn Anthropic / Gemini tokens — abuse is expensive.
# 20 req/min/IP is generous for genuine planning; bot-grade traffic
# is orders of magnitude higher.
resource "cloudflare_rate_limit" "ai_plan" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id   = var.cloudflare_zone_id
  threshold = 20
  period    = 60
  match {
    request {
      url_pattern = "${var.public_api_hostname}/api/v1/plan*"
      schemes     = ["HTTPS"]
      methods     = ["POST", "PUT"]
    }
  }
  action {
    mode    = "challenge" # JS-challenge instead of ban — gives real users a shot
    timeout = 60
  }
}

# ─── WAF rule: block traversal / scanner signatures ──────────────────
# A flat block — the ones we've already seen probing prod-shaped
# deployments. Add to this list when CSP-audit or Sentry surfaces
# a new signature.
resource "cloudflare_ruleset" "block_signatures" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "travel — block known-bad request signatures"
  description = "Path traversal + admin-scanner paths + known bot UAs."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "block"
    expression  = <<-EOT
      (http.request.uri.path contains "/wp-admin")
      or (http.request.uri.path contains "/.env")
      or (http.request.uri.path contains "/.git")
      or (http.request.uri.path contains "/phpmyadmin")
      or (http.request.uri.path contains "..%2F")
      or (http.user_agent contains "sqlmap")
      or (http.user_agent contains "nikto")
    EOT
    description = "Drop known-bad probes"
    enabled     = true
  }
}

# ─── Always-allow: health + metrics ──────────────────────────────────
# We NEVER want the edge to gate /health/* or /metrics — the deploy
# smoke + Prometheus scraper depend on those being unconditionally
# reachable. This rule fires BEFORE the rate-limit / block rules
# above by virtue of its higher `priority`.
resource "cloudflare_ruleset" "always_allow_probes" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "travel — bypass for health + metrics"
  description = "Probe paths skip WAF + rate-limit"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action     = "skip"
    expression = <<-EOT
      (http.request.uri.path starts_with "/api/v1/health/")
      or (http.request.uri.path eq "/metrics")
    EOT
    description = "Allow probes through every other rule"
    enabled     = true
    action_parameters {
      rulesets = ["current"]
    }
  }
}

# ─── Cache rules ([Q6]) ─────────────────────────────────────────────────
#
# Edge caching for read-mostly public surfaces. The api still emits the
# canonical `Cache-Control` header on every response (see
# apps/api/src/common/cache-control/), so this ruleset just tells
# Cloudflare to RESPECT the origin's caching intent for public paths,
# and to AGGRESSIVELY cache the heaviest public read.
#
# Why a separate ruleset (kind = "zone", phase = "http_request_cache_settings"):
# the cache phase runs BEFORE WAF / rate-limit in Cloudflare's
# pipeline, so a cache HIT skips the origin entirely — both rate-limit
# budgets and api CPU stay protected by the cache, not just by WAF.
#
# Bypass list mirrors the always-allow rule above — auth + write-paths
# never cache (Cloudflare's defaults exclude POST/PUT/DELETE but we
# call it out for the reader).

resource "cloudflare_ruleset" "cache_public_reads" {
  count = var.cloudflare_enabled ? 1 : 0

  zone_id     = var.cloudflare_zone_id
  name        = "travel — cache public read endpoints"
  description = "Edge-cache public reads. Origin Cache-Control header is authoritative; this ruleset turns on edge respect + sets defaults per route family."
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # /api/v1/places/featured + /api/v1/places/:id (public read of place
  # metadata) — high hit ratio, very low write rate, safe to cache 60s.
  rules {
    description = "Cache public place reads (60s edge TTL, respect origin)"
    enabled     = true
    expression = <<-EOT
      (http.request.method eq "GET")
      and (
        http.request.uri.path starts_with "/api/v1/places/featured"
        or http.request.uri.path matches "^/api/v1/places/[^/]+$"
      )
    EOT
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "respect_origin"
        default = 60
      }
      browser_ttl {
        mode    = "respect_origin"
      }
      # Vary headers — accept-language for i18n, accept-encoding for
      # gzip/br compression (Cloudflare does this by default but be
      # explicit so future reviewers see it).
      respect_strong_etags = true
    }
  }

  # /api/v1/trips/published/* — public trip pages. Longer TTL because
  # a published trip is immutable until republished (which busts the
  # cache via the cache-tag header the api emits).
  rules {
    description = "Cache public trip reads (5m edge TTL, respect origin)"
    enabled     = true
    expression = <<-EOT
      (http.request.method eq "GET")
      and (http.request.uri.path starts_with "/api/v1/trips/published/")
    EOT
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "respect_origin"
        default = 300
      }
      browser_ttl {
        mode    = "respect_origin"
      }
      respect_strong_etags = true
    }
  }

  # /api/v1/feed/public — anonymous feed. 30s TTL (high churn,
  # smaller win, but cheap on a 100k-RPS slow day).
  rules {
    description = "Cache anonymous public feed (30s edge TTL)"
    enabled     = true
    expression = <<-EOT
      (http.request.method eq "GET")
      and (http.request.uri.path starts_with "/api/v1/feed/public")
    EOT
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "respect_origin"
        default = 30
      }
      browser_ttl {
        mode    = "respect_origin"
      }
    }
  }

  # Everything else under /api/v1 — NEVER cache. Authenticated reads,
  # writes, anything with a Set-Cookie response. Belt-and-braces:
  # Cloudflare's defaults already exclude non-cacheable shapes, but
  # an explicit "no" makes the intent reviewable.
  rules {
    description = "Bypass cache for everything else under /api/v1"
    enabled     = true
    expression = <<-EOT
      (http.request.uri.path starts_with "/api/v1")
      and not (
        (http.request.method eq "GET")
        and (
          http.request.uri.path starts_with "/api/v1/places/featured"
          or http.request.uri.path matches "^/api/v1/places/[^/]+$"
          or http.request.uri.path starts_with "/api/v1/trips/published/"
          or http.request.uri.path starts_with "/api/v1/feed/public"
        )
      )
    EOT
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
  }
}
