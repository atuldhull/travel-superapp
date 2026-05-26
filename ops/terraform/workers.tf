# Worker apps ([Q4]).
#
# Three independently-deployable workers, each its own Fly app:
#
#   - notification-worker  → consumes `notifications` queue
#   - media-service        → consumes `media-variants` queue
#   - crawler-worker       → consumes `crawler-recrawl` queue
#
# Workers do NOT expose HTTP — no `services` block on the machine, no
# IP allocation needed. They consume jobs from Redis and exit cleanly
# on SIGTERM (BullMQ Worker.close() in each src/main.ts).
#
# Each worker carries the SAME secret set as the api (Doppler ships
# the bundle in one shot), but the worker's per-app process only reads
# REDIS_URL + LOG_LEVEL today. When the real dispatcher / Sharp / OSM
# logic migrates in, additional secrets (RESEND_API_KEY, TWILIO_*,
# S3_ENDPOINT, GOOGLE_PLACES_API_KEY, FOURSQUARE_API_KEY) come into
# scope per-worker — explicit per-worker secret filtering will land
# then. Today the simplification "every worker gets every secret" is
# fine since each worker only reads what its env-validator names.

locals {
  # Per-worker shape. Keys match the apps/<name> directory name; the
  # `app` field is the deployed Fly app name (suffixed -staging /
  # -prod by `app_suffix`).
  worker_specs = {
    notification = {
      memory_mb   = 256
      concurrency = 10
    }
    media = {
      memory_mb   = 512
      concurrency = 4
    }
    crawler = {
      memory_mb   = 512
      concurrency = 2
    }
  }

  app_suffix = var.environment == "production" ? "prod" : "staging"

  workers = {
    for k, v in local.worker_specs : k => merge(v, {
      # Fly app names match the per-worker fly.toml convention:
      #   travel-<key>-worker-{staging,prod}     (notification, crawler)
      #   travel-<key>-service-{staging,prod}    (media)
      # Special-case media because its source directory is `apps/media-service`.
      app = k == "media"
        ? "travel-media-service-${local.app_suffix}"
        : "travel-${k}-worker-${local.app_suffix}"
    })
  }
}

resource "fly_app" "worker" {
  for_each = local.workers
  name     = each.value.app
  org      = var.fly_organization
}

resource "fly_app_secrets" "worker" {
  for_each = local.workers
  app      = fly_app.worker[each.key].id
  # Same secret bundle as the api — workers ignore keys they don't read.
  # When per-worker scoping becomes important (real dispatchers
  # landing), narrow this to a per-worker subset of `local.secrets`.
  secrets = local.secrets
}

resource "fly_machine" "worker" {
  for_each = local.workers
  app      = fly_app.worker[each.key].id
  region   = var.primary_region
  name     = "${each.value.app}-0"

  image = "registry.fly.io/${each.value.app}:latest"

  cputype  = "shared"
  cpus     = 1
  memorymb = each.value.memory_mb

  # No `services` block — workers are not HTTP endpoints.

  env = {
    NODE_ENV           = var.environment == "production" ? "production" : "staging"
    LOG_LEVEL          = "info"
    WORKER_CONCURRENCY = tostring(each.value.concurrency)
  }
}
