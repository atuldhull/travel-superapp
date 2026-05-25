# Terraform + provider pinning ([N3]).
#
# Fly.io provider: `fly-apps/fly` (community-maintained, official-blessed).
# It manages apps, machines, secrets, IP allocation, and scaling.
# Other providers (cloudflare, github) land in their own files once
# this baseline is green.
#
# State backend: local for the bootstrap. Move to a remote S3/HCP
# Cloud backend BEFORE wiring CI apply — local state breaks the
# moment more than one operator runs `terraform apply`. See
# README.md §"Remote state".
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    fly = {
      source  = "fly-apps/fly"
      version = "~> 0.0.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
