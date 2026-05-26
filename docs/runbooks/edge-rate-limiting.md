# Runbook — Edge rate limiting (Cloudflare WAF) ([N9])

> **Status:** rules defined in `ops/terraform/cloudflare.tf`, gated
> on `cloudflare_enabled = false` by default. Activate by setting
> `cloudflare_enabled = true` in `envs/production.tfvars` AFTER DNS
> is parked on Cloudflare.

## Why edge AND ThrottlerModule

ThrottlerModule (in `apps/api/src/common/rate-limit/`) rate-limits
**inside the api**. It uses Redis + a sliding-window Lua script,
keys peppered with `RATE_LIMIT_PEPPER`. Per-route limits today:

| Route                       | Limit                  |
| --------------------------- | ---------------------- |
| `/api/v1/auth/login`        | 5 per 15m per identity |
| `/api/v1/auth/register`     | 3 per 60m per IP       |
| Default (every other route) | 60 per minute per IP   |

That's the INNER layer. Cloudflare WAF is the OUTER layer:

| Route                   | Edge limit                               |
| ----------------------- | ---------------------------------------- |
| `/api/v1/auth/login`    | 10 per minute per IP (ban 60s)           |
| `/api/v1/auth/register` | 3 per minute per IP (ban 5min)           |
| `/api/v1/plan*`         | 20 per minute per IP (JS challenge)      |
| Everything else         | (no edge limit; ThrottlerModule does it) |

The edge layer:

- Drops the request BEFORE it crosses our trust boundary (saves
  CPU, DB pool slots, log volume).
- Operates on raw IP (the api sees a coalesced `X-Forwarded-For`,
  which can be spoofed; the edge sees the real socket peer).
- Adds JS challenge / CAPTCHA without us writing JS.

ThrottlerModule still matters because:

- Per-user limits (post-auth) are invisible to the edge.
- Some throttles depend on app-level state (failed-login counter,
  ban list) the edge can't see.

## Activation

```bash
# 1. Park DNS on Cloudflare. The Fly app gets a `<app>.fly.dev`
#    address; create an A or CNAME under the prod zone pointing at
#    the Fly IP (output of `terraform output ipv4_address`).
# 2. Generate a Cloudflare API token scoped to:
#    - Zone:Read
#    - Zone WAF:Edit
#    - Zone Rate Limit:Edit
#    Save it in Doppler under `CLOUDFLARE_API_TOKEN`.
# 3. Flip the toggle in ops/terraform/envs/production.tfvars:
#       cloudflare_enabled  = true
#       cloudflare_zone_id  = "<zone-id-from-cloudflare-dashboard>"
#       public_api_hostname = "api.<your-domain>"
# 4. Re-run the apply workflow.
```

The `cloudflare_rate_limit` + `cloudflare_ruleset` resources flip
on. First request after apply: confirm via Cloudflare → Security →
Events that the rules show up.

## Verify

After activation:

```bash
# Healthy traffic — should never hit a limit.
for i in $(seq 1 5); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    https://api.<your-domain>/api/v1/health/ready
done
# Expect: 200 × 5.

# Auth-burst — 11th login attempt in 60s should 429 from the edge.
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST https://api.<your-domain>/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"x@example.com","password":"wrong"}'
done
# Expect: 401×10, then 429s.
```

## When this fires

Cloudflare → Security → Events shows every rate-limit decision.
The pager DOES NOT see edge-limit events today — they are not
forwarded to Prometheus. If you want them, add a Cloudflare
Logpush → R2 → ETL into Prometheus textfile collector.

If LEGITIMATE traffic is hitting the edge limit (false-positive
spam in support):

1. Confirm in Cloudflare → Security → Events that the rule fired
   on the user's IP.
2. Bump the limit in `cloudflare.tf` AND re-apply.
3. If the request shape is unusual (e.g., a partner with a known
   IP block doing high-volume legitimate traffic), add their IPs
   to an allowlist in a follow-up rule:

   ```hcl
   resource "cloudflare_ruleset" "allowlist_partner_x" {
     count = var.cloudflare_enabled ? 1 : 0
     # ... expression = (ip.src in {1.2.3.0/24})  →  action = skip
   }
   ```

## Blocking + abuse triage

When a real attack is in progress:

```bash
# 1. Read live: Cloudflare → Security → Events, filter by Rate
#    Limit. Identify the top offending IP / IP range.

# 2. Add to the temporary block list (Cloudflare → Security →
#    WAF → Tools → IP Access Rules):
#       <ip-or-cidr>  →  Block  →  Note "incident-2026-MM-DD"

# 3. After the incident, decide whether the block is permanent
#    (botnet C2, scanner range) or 24h (transient).
```

The `block_signatures` rule in cloudflare.tf already drops the
common scanner UAs + path-traversal patterns. Add new signatures
there as they appear — the change goes through `terraform-plan`,
review, apply.

## What this DOES NOT do

- **L7 DDoS mitigation** — Cloudflare's free plan helps but isn't
  a real DDoS shield. Pro / Business tiers add Bot Management +
  Magic Transit. The 4Tb/s "Cloudflare just absorbs it" reputation
  applies most strongly to paid tiers.
- **Per-user limits** — edge sees IP only. Per-user (post-auth)
  limits stay in `@nestjs/throttler`.
- **WAF rule tuning** — the rules above are a sane default; tune
  via Cloudflare → Security → WAF after first month of traffic
  shows what real shape looks like.

## Cross-refs

- [`apps/api/src/common/rate-limit/`](../../apps/api/src/common/rate-limit/) — the inner layer
- [`ops/terraform/cloudflare.tf`](../../ops/terraform/cloudflare.tf) — the rule definitions
- [`docs/security/threat-model.md`](../security/threat-model.md) — top abuse scenarios + mitigation status
- [`docs/runbooks/slo-availability.md`](slo-availability.md) — what to do when the pager fires
- [`docs/runbooks/auth-error-spike.md`](auth-error-spike.md) — the credential-stuffing path
