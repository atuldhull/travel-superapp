#!/usr/bin/env node
/**
 * SDK drift gate — fails if the checked-in `docs/api/openapi.yaml`
 * or the orval-generated SDK under `packages/sdk/src/generated/`
 * are stale relative to the live NestJS controller surface.
 *
 * Pipeline:
 *   1. Regenerate `docs/api/openapi.yaml` from AppModule's running
 *      controller + decorator metadata (`pnpm --filter=api api:openapi`).
 *   2. Regenerate the SDK from the (now-current) openapi.yaml via
 *      orval (`pnpm --filter=@app/sdk sdk:gen`).
 *   3. Run `git diff --exit-code` over both paths. Any diff means a
 *      controller changed without running the regen — gate fails,
 *      shows the diff summary, and exits 1.
 *
 * Invariant the gate enforces (10/10 client-generation story per the
 * road-to-10 review): there is ONE typed client (the orval SDK), and
 * it is regenerated in CI. New endpoints can't ship a hand-rolled
 * `apiFetch` story by accident — the SDK is always current.
 *
 * Usage:
 *   pnpm sdk:check
 *
 * Exit codes:
 *   0  — openapi.yaml + SDK are current.
 *   1  — drift detected OR a regen step failed.
 *
 * NOTE on hermeticity: the AppModule boot uses placeholder env values
 * baked into `export-openapi.ts` (DATABASE_URL / REDIS_URL / S3 / JWT
 * peppers), so the gate doesn't need real infra. Redis reconnect
 * timers do keep the event loop alive past `app.close()`, which is
 * why `export-openapi.ts` ends with `process.exit(0)` (see [D1]).
 *
 * Installed by [D1] — single-client-story enforcement.
 */
const { execSync, spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const OPENAPI_PATH = 'docs/api/openapi.yaml';
const SDK_GENERATED_PATH = 'packages/sdk/src/generated';

function step(label, cmd) {
  process.stdout.write(`[sdk-check] ${label}... `);
  const t0 = Date.now();
  const result = spawnSync(cmd, {
    cwd: REPO_ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const ms = Date.now() - t0;
  if (result.status !== 0) {
    process.stdout.write(`FAILED (${ms}ms)\n`);
    process.stderr.write(`\n----- ${label} stdout -----\n${result.stdout}\n`);
    process.stderr.write(`----- ${label} stderr -----\n${result.stderr}\n`);
    process.exit(1);
  }
  process.stdout.write(`ok (${ms}ms)\n`);
}

step('regenerating openapi.yaml', 'pnpm --filter=api api:openapi');
step('regenerating @app/sdk', 'pnpm --filter=@app/sdk sdk:gen');

// `git diff --exit-code` returns 1 when there are unstaged changes.
// We only care about the two tracked paths the regen touches.
const diff = spawnSync('git', ['diff', '--stat', '--', OPENAPI_PATH, SDK_GENERATED_PATH], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (diff.status !== 0) {
  process.stderr.write(`[sdk-check] git diff failed: ${diff.stderr}\n`);
  process.exit(1);
}

if (diff.stdout.trim().length === 0) {
  process.stdout.write('[sdk-check] ✔ openapi.yaml + @app/sdk are current.\n');
  process.exit(0);
}

process.stderr.write('\n[sdk-check] ✘ DRIFT DETECTED — the spec or SDK is stale.\n');
process.stderr.write(
  '            A controller changed without running the regen, OR the\n' +
    '            decorator surface changed (@ApiBody / @ApiResponse / etc).\n\n',
);
process.stderr.write(diff.stdout);
process.stderr.write(
  '\nFix:\n' +
    '  1. Inspect what changed.\n' +
    '  2. Commit the regenerated files (or revert the controller change).\n' +
    '  3. Re-run `pnpm sdk:check` to confirm green.\n',
);
process.exit(1);
