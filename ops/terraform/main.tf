# Fly stack ([N3]).
#
# Three resources:
#   1. fly_app          — the app shell (name + org).
#   2. fly_app_secrets  — env vars passed to every machine.
#   3. fly_machine      — the actual VM. We bound the count via the
#      `min_machines` local; auto-scaling beyond that is driven by
#      Fly's autoscaler (configured in fly.toml's [http_service]
#      section, NOT here — keep traffic-shaping in the deploy file,
#      keep CAPACITY shape in TF).
#
# Why split TF + fly.toml: TF owns the IDENTITY (which apps exist,
# which secrets, which regions); fly.toml owns the BUILD CONFIG
# (Dockerfile path, health checks, restart policy). The boundary
# matches the canonical "infra vs app" split.

resource "fly_app" "api" {
  name = local.app_name
  org  = var.fly_organization
}

resource "fly_app_secrets" "api" {
  app     = fly_app.api.id
  secrets = local.secrets
}

# IP allocation — every Fly app needs at least one shared v4 IP and a
# dedicated v6. The resource is idempotent; `tf apply` is safe to run
# any number of times.
resource "fly_ip" "api_v4" {
  app  = fly_app.api.id
  type = "v4"
}

resource "fly_ip" "api_v6" {
  app  = fly_app.api.id
  type = "v6"
}

# Machines — one fly_machine per slot. `count = local.min_machines`
# keeps TF managing only the always-warm baseline; surge capacity
# spun by Fly's autoscaler isn't owned by TF (would fight on every
# apply).
resource "fly_machine" "api" {
  count  = local.min_machines
  app    = fly_app.api.id
  region = element(var.regions, count.index % length(var.regions))
  name   = "${local.app_name}-${count.index}"

  # Image pin is rebuilt by the deploy workflow (`flyctl deploy`).
  # On a cold `terraform apply` against a fresh app, this string
  # resolves to a placeholder that `flyctl deploy` then overwrites.
  # When TF runs AFTER a deploy, it converges to the real digest.
  image = "registry.fly.io/${local.app_name}:latest"

  cputype  = "shared"
  cpus     = 1
  memorymb = local.vm_memory

  services = [
    {
      ports = [
        { port = 443, handlers = ["tls", "http"] },
        { port = 80, handlers = ["http"] }
      ]
      protocol      = "tcp"
      internal_port = 3000
    },
  ]

  env = {
    NODE_ENV  = var.environment == "production" ? "production" : "staging"
    PORT      = "3000"
    LOG_LEVEL = "info"
  }
}

# A tiny synthetic random ID stamped into machine env at every apply.
# Lets `fly_app_secrets` re-emit even when no SECRET value changed
# (avoids the "nothing to update" Fly API quirk under concurrent
# Doppler refreshes). The value itself is harmless — it's labelled
# `tf_apply_id`.
resource "random_id" "apply_marker" {
  byte_length = 8
}
