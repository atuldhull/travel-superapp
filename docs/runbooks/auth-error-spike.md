# Runbook — Auth error-rate spike

**Fires:** `AuthErrorRateElevated` (ticket).
**Trigger:** > 0.1 req/s of 5xx on `/api/v1/auth/*` over 5 m.
**Source rule:** [ops/prometheus/rules/api.rules.yml](../../ops/prometheus/rules/api.rules.yml) group `api.alerts.resilience`.

Auth-route 5xx is suspicious because the happy + sad paths there
are both well-defined 4xx (`401 INVALID_CREDENTIALS`, `429`,
`403`, `409 EMAIL_EXISTS`). 5xx means something genuinely broke.

## Triage script

### 1. What's the actual error?

```bash
fly logs --app travel-api --since=10m | grep -iE 'auth|login|register' | grep -v 'INVALID_CREDENTIALS\|EMAIL_EXISTS'
```

Look for the dominant stack trace.

### 2. Pattern: failed-login counter wedged

Symptom: every login attempt 5xx's with a Redis-related stack
trace. Cause: Redis outage; `RedisFailedLoginCounter.increment()`
throws + propagates.

Fix:

```bash
# Confirm: is Redis up?
redis-cli -u "$REDIS_URL" ping

# Emergency: degrade gracefully — disable account lockout, let logins through.
# (Account lockout is defense-in-depth, not a primary security boundary.)
fly secrets set ACCOUNT_LOCKOUT_DISABLED=true --app travel-api
fly deploy --app travel-api
```

### 3. Pattern: credential-stuffing in progress

Symptom: huge volume of POSTs to `/api/v1/auth/login` from a few
IPs, mostly 401 INVALID_CREDENTIALS, with occasional 5xx from
overloaded paths (rate-limit-counter contention, Sentry blocking
on send, etc.).

Fix:

```bash
# Step 1: block the IPs at the edge (Cloudflare → Security → WAF rules).
# Add: `(ip.src in {<list>})` → Block.

# Step 2: tighten the throttler temporarily.
# In apps/api/src/modules/identity/identity.module.ts, lower the
# /login throttle from default to {limit: 3, ttl: 60_000}.

# Step 3: open `docs/runbooks/auth-error-spike-postmortem.md` (template
# inside incident-response.md).
```

### 4. Pattern: JWT-keyring rotation race

Symptom: every login succeeds but subsequent `/refresh` 5xx's.
Cause: a fresh deploy issued tokens with `kid=ring-new`, but the
verifier still has `kid=ring-bootstrap` cached in-memory for up to
30 s ([CACHE_TTL_MS](../../apps/api/src/modules/identity/infrastructure/redis-jwt-keyring.store.ts)).

Fix: wait 30 s for the in-memory cache to expire. If it persists,
flush the keyring cache:

```bash
fly ssh console --app travel-api
redis-cli -u "$REDIS_URL" del 'travel-prod:jwt-keyring:access' 'travel-prod:jwt-keyring:refresh'
# Forces re-bootstrap. Sessions issued in the past 30s lose verification
# — users get logged out. That's acceptable for an incident.
```

## Why this isn't a page

`AuthErrorRateElevated` fires AFTER the 5m window. The general
`ApiAvailabilityBurnFast` page covers truly cataclysmic auth
breakage. This ticket exists so we DON'T miss the slow-burn
"auth is mostly degraded" state that an availability gauge
misses (because it averages across millions of healthy requests).

## Post-incident

- Run `pnpm --filter=api test -- --testPathPattern='identity|auth'`
  to confirm no test caught what prod missed. If a regression DOES
  reproduce in test, file the patch immediately.
- Add a row to [SECURITY.md threat model](../security/threat-model.md)
  if this was a real attack.
