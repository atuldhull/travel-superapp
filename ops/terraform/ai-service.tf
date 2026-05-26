# ai-service ([R6]) — Python FastAPI sidecar deployed as its own Fly app.
#
# Today this is a stub (no model weights baked in). The deploy stack
# proves the architecture works end-to-end; real inference logic lands
# in prompt [IV.18.2.11]. See:
#   - apps/ai-service/main.py — stub endpoints
#   - apps/ai-service/Dockerfile — 3-stage Python 3.12 build
#   - apps/ai-service/fly.toml — Fly app config
#   - docs/architecture/ai-inference-scale.md (Q10) — the scaling plan
#
# Unlike the Node workers (workers.tf), ai-service IS an HTTP service
# called by apps/api. So it gets an IP allocation + http_service.

locals {
  ai_service_app = "travel-ai-service-${local.app_suffix}"
}

resource "fly_app" "ai_service" {
  name = local.ai_service_app
  org  = var.fly_organization
}

resource "fly_ip" "ai_service_v4" {
  app  = fly_app.ai_service.id
  type = "v4"
}

resource "fly_ip" "ai_service_v6" {
  app  = fly_app.ai_service.id
  type = "v6"
}

resource "fly_app_secrets" "ai_service" {
  app = fly_app.ai_service.id
  # Same secret bundle as the api today; ai-service reads only what
  # it consumes. Narrow when paid LLM keys land (real model code in
  # [IV.18.2.11] knows whether it needs ANTHROPIC_API_KEY or just
  # the in-process stub).
  secrets = local.secrets
}

resource "fly_machine" "ai_service" {
  # One machine per region — same shape as the api. ai-service is
  # cheap (1 GB) until real models load; the multi-region spread
  # gives Q9 failover for translation / embeddings at no extra cost.
  count = length(var.regions)

  app    = fly_app.ai_service.id
  region = element(var.regions, count.index)
  name   = "${local.ai_service_app}-${var.regions[count.index]}"

  image = "registry.fly.io/${local.ai_service_app}:latest"

  cputype  = "shared"
  cpus     = 1
  memorymb = 1024

  services = [
    {
      ports = [
        { port = 443, handlers = ["tls", "http"] },
        { port = 80, handlers = ["http"] }
      ]
      protocol      = "tcp"
      internal_port = 8001
    },
  ]

  env = {
    PORT = "8001"
  }
}
