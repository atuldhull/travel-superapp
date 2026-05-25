# Infrastructure as code — Fly stack ([N3])

> **Status:** plan-clean, never been applied. Bootstrap below.

## Why

Before [N3] the Fly stack was operator-owed: `fly launch`, `fly secrets set`,
`fly scale count`, etc., were one-off commands run from someone's
laptop. There was no record of "what is this account configured to
look like", no review gate, no drift detection. Terraform fixes that:

- The desired state is in this directory, in version control.
- PR `terraform-plan` shows the diff before merge.
- `terraform-apply` (manual workflow_dispatch + GitHub Environment
  approval) is the only path that mutates Fly.

## Layout

```
ops/terraform/
├── README.md            # this file
├── versions.tf          # provider pin (fly-apps/fly ~> 0.0.23)
├── variables.tf         # all inputs + their defaults + secrets
├── main.tf              # the resources: fly_app, fly_app_secrets, fly_ip, fly_machine
├── outputs.tf           # app name, ipv4/6, machine ids
└── envs/
    ├── staging.tfvars   # non-sensitive staging defaults
    └── production.tfvars
```

Secrets (DATABASE*URL, JWT*\*, HONEYCOMB_API_KEY, etc.) are NEVER in
this repo. They land via Doppler at CI-apply time — see
[`.github/workflows/terraform-apply.yml`](../../.github/workflows/terraform-apply.yml).

## Bootstrap (first-time)

```bash
# 1. Install terraform >= 1.6
brew install terraform   # mac
# or: choco install terraform  # windows

# 2. Auth to Fly.
fly auth login

# 3. cd in.
cd ops/terraform

# 4. Initialise (downloads provider).
terraform init -backend=false

# 5. Plan against staging WITHOUT secrets (shape only).
terraform plan -var-file=envs/staging.tfvars

# 6. Apply once you trust the plan. Real secrets via env:
export TF_VAR_database_url='postgresql://...'
export TF_VAR_redis_url='redis://...'
# ... etc — see variables.tf
terraform apply -var-file=envs/staging.tfvars
```

## Remote state (DO BEFORE CI APPLY)

Local state breaks the second a second operator (or CI) runs apply.
The community-blessed backend for Fly TF is HCP Terraform Cloud
(free tier) or S3-equivalent on Backblaze B2 / R2.

Add this to `versions.tf` once a backend is provisioned:

```hcl
terraform {
  backend "s3" {
    bucket = "travel-tfstate"
    key    = "fly/api.tfstate"
    region = "us-east-1"
    # If using R2 / B2, set endpoint + skip_credentials_validation.
  }
}
```

Then `terraform init -migrate-state` to move local → remote ONCE.

## CI wire-up

| Workflow              | Triggers                                          | What                                                                                              |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `terraform-plan.yml`  | PR touching `ops/terraform/**` or these workflows | Posts plan diff as PR comment. Plan-only.                                                         |
| `terraform-apply.yml` | Manual workflow_dispatch                          | Reads Doppler → emits TF*VAR*\*. Apply gated by a GH Environment that requires reviewer approval. |

Required repo secrets:

- `FLY_API_TOKEN` — `flyctl tokens create deploy --name terraform-ci` (rotate quarterly).
- `DOPPLER_TOKEN` — Doppler service token scoped to the right project / config.

Required GitHub Environments (Settings → Environments):

- `staging` — no required reviewers; auto-merges after plan-clean.
- `production` — 1 required reviewer + a 5-min wait timer for an
  abort window.

## When to apply

| Change                                     | Path                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Edit `*.tfvars` (memory, regions, scaling) | PR → plan review → merge → trigger apply                                                      |
| Add a new secret                           | Add it in Doppler → add a `variable` block in `variables.tf` → reference in `secrets_all` map |
| Rotate a secret                            | Update in Doppler → trigger apply (secrets-only path; no machine recreation)                  |
| New app / region                           | PR adding a region to the `regions` list; apply rolls out one machine at a time               |

## Limits + non-goals (today)

- **No Cloudflare/Doppler/GitHub providers** yet — those grow in
  follow-up commits ([N6] for Doppler, [N9] for Cloudflare WAF).
- **No auto-scale config** — Fly's autoscaler runs OUTSIDE TF
  (configured in `fly.toml`). TF owns the always-warm baseline.
- **No Postgres / Redis provisioning** — Supabase + Upstash are
  provisioned via their own dashboards. Strings are captured as
  TF inputs only.
- **No drift remediation cron** — `terraform plan -detailed-exitcode`
  on a nightly schedule is the next polish step.

## Verification (locally, without applying)

```bash
cd ops/terraform
terraform fmt -recursive -check          # passes
terraform init -backend=false            # downloads provider
terraform validate                        # passes
terraform plan -var-file=envs/staging.tfvars  # shape, no diff against live
```

The `terraform-plan.yml` workflow runs exactly these four steps on
every PR.
