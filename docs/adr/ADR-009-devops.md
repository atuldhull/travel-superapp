# ADR-009 — DevOps & infra: pnpm + Turborepo + Docker + Fly.io/Railway (v1), Terraform-ready for AWS

- **Status:** Accepted
- **Date:** 2026-04-20
- **Prompt:** `[II.8.6]`
- **Playbook reference:** §8.6 + §34.3

## Context

The TravelSuperApp stack is locked across four ADRs already — frontend ([ADR-005](./ADR-005-frontend-stack.md)), backend ([ADR-006](./ADR-006-backend-stack.md)), data layer ([ADR-007](./ADR-007-data-layer.md)), AI ([ADR-008](./ADR-008-ai-stack.md)). The **deploy and operate** surface — how that stack reaches users — has been implicit in the repo ("Docker Compose locally, Fly.io in prod") but never formally pinned. This ADR closes the gap.

The choices here drive real monthly spend, the CI pipeline's shape, and how many ops hats a 1–3 engineer team wears. The whole of Phase 0 was designed to reach ~100k MAU on v1 infra without a re-architecture; Kubernetes comes later, on explicit triggers — NOT on a growth gut-feeling.

## Decision drivers

- **Time-to-user over ops sophistication.** Every week spent on infra before the product exists is a week users aren't touching anything. Fly.io / Railway let one engineer deploy a Dockerfile and have a globally-routed app in an hour. EKS/GKE is two weeks of yak-shaving minimum.
- **One monorepo, typed end-to-end.** pnpm workspaces + Turborepo give us incremental builds, remote cache, and workspace:\* linking that npm can't match without a bolt-on.
- **Secrets MUST rotate.** `.env` files in a repo are a CLAUDE.md rule-5 violation; unrotated Kubernetes Secrets are only marginally better. Doppler or AWS Secrets Manager from day one — we chose Doppler.
- **CI pipeline is shared infrastructure.** Every PR runs the same lint + typecheck + jest + build matrix. Turbo's remote cache turns a cold 8-min CI into a 30-second hot cache hit — non-trivial for a small team iterating fast.
- **We WILL outgrow Fly at some point.** The design must make the migration a mechanical swap (Dockerfile already distroless, infra Terraform-ready), not a rewrite.
- **Kubernetes migration needs QUANTITATIVE triggers.** Growth-based, spend-based, capability-based. Judgement calls turn into arguments that never end.

## Considered choices (each locked, each with one rejected alternative)

### 1. Package manager + monorepo — **pnpm 9 + Turborepo 2**

**Chosen.** pnpm's content-addressable store makes `node_modules` tiny and deterministic — CI cold installs land in 30 s that would take 2+ min with npm. Turbo handles task orchestration + remote cache across the monorepo. `workspace:*` linking keeps intra-repo deps honest. This is already the shape we're shipping — ratifies reality.

**Rejected alternative: npm workspaces + Nx.** Nx is more feature-rich than Turbo but adds its own generator + project-graph DSL that we'd have to learn and maintain. npm workspaces without Nx lacks task orchestration. Pair is doable but the combined complexity exceeds Turbo's surface for our needs.

### 2. Hosting v1 — **Fly.io** (primary) + **Railway** (fallback)

**Chosen.** Dockerfile → `fly deploy` ships a globally-routed app in minutes. Built-in anycast + TLS + zero-config rolling deploys + per-region autoscaling. Postgres, Redis, secrets all first-class. The "v1 scale ceiling" is ~100k MAU on commodity machines without any tuning — well past our first-year target.

**Rejected alternative: AWS ECS from day one.** Fully managed, well-understood, great scaling. But: VPC setup, ALB config, task definitions, IAM roles, ECR — easily a two-week stand-up for a team of 1–3, and you're paying for idle ALB + NAT Gateway regardless of traffic. ECS becomes the right answer when we cross the triggers below, NOT at the start.

### 3. CI/CD — **GitHub Actions + Turborepo remote cache + Docker Buildx + Trivy**

**Chosen.** GitHub Actions is free for our workspace's minute quota, composable with any step, and the workflow files live alongside code. Turbo remote cache (Vercel's free tier for OSS-ish repos, or Turborepo Cloud paid tier later) makes warm cache hits ~30× faster than cold. Docker Buildx + Trivy in the same pipeline — build + SBOM + image scan — with one conventional-commits changelog surface.

**Rejected alternative: CircleCI / GitLab CI.** Both are excellent; CircleCI in particular has better machine-sized steps. But GitHub Actions integrates with PR reviews, Dependabot, Code-Scanning, and GHCR out of the box — the integration delta for a small team on GitHub is larger than the feature delta on any other CI.

### 4. CDN / WAF — **Cloudflare**

**Chosen.** Free tier covers launch (DDoS, WAF, DNS, SSL, cache). Workers + R2 are already in the roadmap (R2 for object storage per [ADR-007](./ADR-007-data-layer.md) in prod). Cloudflare's global anycast front matches Fly's region layout — Fly's app + Cloudflare's cache is a clean two-layer topology.

**Rejected alternative: AWS CloudFront + WAF + Route 53.** Equivalent feature coverage. But the TCO is meaningfully higher (CloudFront per-request billing + WAF rule cost), and you need an AWS account + IAM setup to configure anything. Cloudflare's control plane is one dashboard, one API, one invoice.

### 5. Secrets — **Doppler**

**Chosen.** Per-environment projects, automatic rotation, CLI + dashboard, works with Docker / Fly / Vercel / local dev (`doppler run -- pnpm dev`). Free tier covers 5 users and unlimited secrets. Audit trail of who-read-what-when. The `.env.example` sentinel pattern ([IX.32.4]) pairs with Doppler — local devs run `doppler run --project travel --config dev -- pnpm dev` and never see a real secret in a file.

**Rejected alternative: AWS Secrets Manager from day one.** Well-integrated with AWS services; per-secret pricing is low at small volumes. But: requires an AWS account before you can run `pnpm dev` locally (bad DX), no built-in multi-env project abstraction (each env is a separate ARN to manage), and rotation policies are per-secret rather than per-project. Revisit if we migrate to ECS/EKS — Secrets Manager becomes natural once AWS is already in play.

## Summary

| #   | Layer                      | Chosen                                        | Rejected (one)                |
| --- | -------------------------- | --------------------------------------------- | ----------------------------- |
| 1   | Package manager + monorepo | pnpm 9 + Turborepo 2                          | npm workspaces + Nx           |
| 2   | Hosting v1                 | Fly.io (primary) + Railway (fallback)         | AWS ECS from day one          |
| 3   | CI/CD                      | GitHub Actions + Turbo cache + Buildx + Trivy | CircleCI / GitLab CI          |
| 4   | CDN / WAF                  | Cloudflare                                    | AWS CloudFront + WAF          |
| 5   | Secrets                    | Doppler                                       | AWS Secrets Manager (day one) |

## Consequences (binding)

- **`pnpm install --frozen-lockfile`** in CI — no lockfile drift. Local dev runs `pnpm install` which may bump patches; CI rejects the result if the lockfile changes under `--frozen-lockfile`.
- **Dockerfile MUST be distroless + non-root.** Already the shape in `apps/api/Dockerfile` (from [IV.17.x]). Applies to every future app.
- **`.env` files are `.gitignore`'d.** Real secrets live in Doppler; the only committed env file is `.env.example` with `REPLACE_ME_SEE_DOPPLER` sentinels (Playbook §13.10 + [IX.32.4]). CLAUDE.md rule 5 enforces at review.
- **Every deploy produces an SBOM** (CycloneDX format via Trivy) and a container scan. Hard-block any deploy where Trivy reports a `CRITICAL` CVE in a direct dependency.
- **Terraform scaffold lives in `infra/terraform/`** (ready but not wired). When the K8s triggers fire, we `terraform plan` against an AWS account and the infra + Helm charts already exist in `infra/k8s/`. Scaffolding today = no rewrite tomorrow.
- **No auto-upgrades on paid plans.** Fly.io, Vercel, Supabase all offer auto-scale tiers — we disable them. Alarm at 80% of the current-tier budget; a human confirms the upgrade.

## Kubernetes migration triggers (QUANTITATIVE — acceptance criterion)

This ADR binds us to Fly.io / Railway for v1. We move to EKS or GKE when **ANY** of the following thresholds is crossed, measured over a rolling 30-day window:

1. **Regional scale.** Deployed + serving real production traffic in **≥ 4 distinct regions** AND **aggregate MAU ≥ 500,000**. (The MAU floor matters — deploying in 4 regions with 5 users in each isn't a K8s trigger, it's over-provisioning.)

2. **Monthly hosting bill.** Fly.io + Railway + Vercel + Cloudflare combined > **$15,000/month** AND **> 40%** of total COGS per Playbook §23.1. Above this line, direct-to-AWS economics start favouring raw EKS nodes + spot instances.

3. **GPU workloads at scale.** Self-hosted LLM inference sustained at **> 100 inference requests/second** for any **continuous 24-hour window** AND Fly's GPU pricing for that workload exceeds **2×** the equivalent EKS-with-spot-instances cost. (Ai-service today is NLLB/Whisper/DistilBERT on CPU — this trigger only fires once we self-host Llama 3.1 per [ADR-008](./ADR-008-ai-stack.md).)

4. **Custom networking** — a genuine architectural requirement that Fly's anycast + private WireGuard mesh can't serve (e.g. regulatory data-residency isolation per-region, on-prem connectivity to a B2B customer). Qualitative but bounded — NOT "we prefer K8s for resume value."

If ANY of 1–4 crosses, open a superseding ADR naming the target (EKS vs GKE vs self-managed). The migration IS a supported path, not a panic — the Dockerfile already runs on any Kubernetes node; the Helm chart scaffold in `infra/k8s/` is the seed.

Crossing threshold 2 without triggers 1 or 3 is the most common false positive — it usually means we have a cost bug (missing CDN cache, unbounded PostHog captures, zombie staging envs) rather than an infra-ceiling problem. **Always root-cause the spend before ADR-superseding on trigger 2 alone.**

## Re-evaluation triggers (separate from K8s migration)

Review this ADR if:

- **Fly.io's SLA degrades.** We've already committed to Fly; any Sev-1 affecting > 1 h of downtime attributable to Fly's platform is a data point. Two in 30 days → re-evaluate.
- **Cloudflare's free tier changes materially.** Historically stable; any move of DDoS / WAF / Workers behind a paywall affects our TCO story.
- **GitHub Actions minute quota.** We're on the free tier budget + paid overage. Hitting >80% of the monthly minute cap = either optimise (aggressive Turbo cache, conditional workflows) or pay for a higher tier.
- **Doppler's compliance posture changes.** If SOC 2 readiness ([Phase 4]) requires a customer-managed key path Doppler doesn't offer, AWS Secrets Manager with CMK becomes the answer.

## Links

- Playbook §8.6 (DevOps table) · §34.2 (hosting v1) · §34.3 (K8s migration trigger) · §23.1 (COGS).
- Sibling ADRs: [ADR-005 Frontend](./ADR-005-frontend-stack.md) · [ADR-006 Backend](./ADR-006-backend-stack.md) · [ADR-007 Data](./ADR-007-data-layer.md) · [ADR-008 AI](./ADR-008-ai-stack.md).
- [Fly.io](https://fly.io/docs/) · [Turborepo](https://turbo.build/repo/docs) · [Cloudflare](https://developers.cloudflare.com/) · [Doppler](https://docs.doppler.com/).
