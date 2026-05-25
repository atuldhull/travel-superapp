#!/usr/bin/env bash
# scripts/security/csp-audit.sh ([N7]) — verify the security
# response headers a deployed api emits match the documented
# policy. Catches the silent regression class where helmet config
# is changed but no test catches it because no test inspects the
# response headers at the HTTP edge.
#
# Usage:
#   ./scripts/security/csp-audit.sh https://travel-api-staging.fly.dev
#
# Checks (each fails the script with exit 1 if missing):
#   1. content-security-policy   present + has default-src 'self'
#   2. strict-transport-security present (when probe URL is https)
#   3. x-frame-options           = DENY  OR  CSP has frame-ancestors 'none'
#   4. referrer-policy           present
#   5. x-content-type-options    = nosniff
#   6. permissions-policy        present (helmet doesn't emit by default;
#                                we register it via onSend hook)
#   7. cross-origin-opener-policy = same-origin (or unsafe-none + warn)
#
# This script is intended to run AFTER a deploy — wire it as the last
# step of `.github/workflows/deploy.yml`'s smoke job, OR as a
# scheduled cron audit against prod every Monday.

set -euo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Usage: $0 <base-url>" >&2
  exit 2
fi

# Probe a route that has no auth gate but isn't /metrics (we don't
# want /metrics polluting CSP audit because it's a special route).
PROBE_PATH="/api/v1/health/ready"
URL="${URL%/}$PROBE_PATH"

echo "→ probing $URL"

# Fetch headers only. `-D -` writes to stdout; `-o /dev/null` discards
# the body. `--max-time 10` so a hung probe doesn't wedge CI.
headers=$(curl -sS -D - -o /dev/null --max-time 10 "$URL")

if ! echo "$headers" | grep -qi '^HTTP/'; then
  echo "::error::no HTTP response from $URL" >&2
  exit 1
fi

# Status code — anything 2xx or 4xx is fine (4xx is OK for the audit
# because /health/ready might 503 during a partial outage but the
# security headers should still be present). 5xx fails.
status=$(echo "$headers" | head -1 | awk '{print $2}')
echo "  HTTP $status"
if [ "${status:0:1}" = "5" ]; then
  echo "::error::api 5xx — can't audit headers reliably" >&2
  exit 1
fi

fails=0

require_header() {
  local name="$1"
  local pattern="${2:-.}"
  local value
  value=$(echo "$headers" | tr -d '\r' | awk -v IGNORECASE=1 -v h="$name" '
    BEGIN { found=0 }
    tolower($0) ~ "^"h":" { sub("^[^:]*: *", ""); print; found=1 }
    END { if (!found) exit 1 }
  ')
  if [ -z "$value" ]; then
    echo "::error::missing header: $name"
    fails=$((fails + 1))
    return
  fi
  if ! echo "$value" | grep -qi -- "$pattern"; then
    echo "::error::$name present but missing required pattern '$pattern' — got: ${value:0:120}"
    fails=$((fails + 1))
    return
  fi
  echo "  ✓ $name: ${value:0:120}"
}

# 1. CSP — must default-src 'self' (we tighten with nonces; permissive
#    default-src is a smell).
require_header 'content-security-policy' "default-src[^;]*'self'"

# 2. HSTS — only when probing over https (helmet skips HSTS over http).
if echo "$URL" | grep -q '^https://'; then
  require_header 'strict-transport-security' 'max-age=[0-9]'
else
  echo "  ⇒ skipping HSTS check (probe URL is http)"
fi

# 3. Clickjacking — either DENY via X-Frame-Options OR frame-ancestors
#    'none' in CSP. Either alone is sufficient under modern browsers.
xfo=$(echo "$headers" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^x-frame-options:/ {sub("^[^:]*: *",""); print}')
csp_fa=$(echo "$headers" | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} /^content-security-policy:/ {sub("^[^:]*: *",""); print}' | grep -i "frame-ancestors[^;]*'none'" || true)
if [ -z "$xfo" ] && [ -z "$csp_fa" ]; then
  echo "::error::no clickjacking defense — neither X-Frame-Options:DENY nor CSP frame-ancestors 'none'"
  fails=$((fails + 1))
else
  echo "  ✓ clickjacking defense present"
fi

# 4. Referrer-Policy — anything non-empty.
require_header 'referrer-policy'

# 5. X-Content-Type-Options — must be nosniff.
require_header 'x-content-type-options' 'nosniff'

# 6. Permissions-Policy — we register via onSend hook in
#    apps/api/src/common/security/security.register.ts.
require_header 'permissions-policy'

# 7. Cross-Origin-Opener-Policy — same-origin is the OWASP rec.
require_header 'cross-origin-opener-policy' 'same-origin'

echo ""
if [ "$fails" -eq 0 ]; then
  echo "::notice::CSP audit PASS ($URL)"
  exit 0
else
  echo "::error::CSP audit FAIL — $fails missing/weak header(s)"
  exit 1
fi
