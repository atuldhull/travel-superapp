#!/usr/bin/env node
/**
 * Shared-types drift gate — fails if `packages/shared-types/schemas/
 * ai-service/*.schema.json` are stale relative to the Zod source
 * files under `packages/shared-types/src/ai-service/`.
 *
 * Pipeline:
 *   1. Regenerate the JSON Schemas from the Zod sources.
 *   2. `git diff --exit-code` over `packages/shared-types/schemas/`.
 *      Any diff means a Zod schema changed without re-running the
 *      emitter — gate fails, shows the diff summary, exits 1.
 *
 * Invariant the gate enforces: the language-neutral handoff to the
 * Python `ai-service` is always current. A controller-side Zod
 * change automatically forces a schema regen on the same PR; the
 * Python side picks it up via its own datamodel-code-generator run
 * over these files.
 *
 * Usage: pnpm shared-types:check
 *
 * Installed by [F3] — making the ai-service contract bilingual.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const SCHEMAS_PATH = 'packages/shared-types/schemas';

function step(label, cmd) {
  process.stdout.write(`[shared-types-check] ${label}... `);
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

step('regenerating ai-service JSON schemas', 'pnpm --filter=@app/shared-types schemas:emit');

const diff = spawnSync('git', ['diff', '--stat', '--', SCHEMAS_PATH], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (diff.status !== 0) {
  process.stderr.write(`[shared-types-check] git diff failed: ${diff.stderr}\n`);
  process.exit(1);
}

if (diff.stdout.trim().length === 0) {
  process.stdout.write('[shared-types-check] ✔ schemas/ai-service/ is current.\n');
  process.exit(0);
}

process.stderr.write('\n[shared-types-check] ✘ DRIFT DETECTED — schemas are stale.\n');
process.stderr.write('            A Zod source changed without running the emitter.\n\n');
process.stderr.write(diff.stdout);
process.stderr.write(
  '\nFix:\n' +
    '  pnpm --filter=@app/shared-types schemas:emit\n' +
    '  git add packages/shared-types/schemas\n' +
    '  pnpm shared-types:check   # confirm green\n',
);
process.exit(1);
