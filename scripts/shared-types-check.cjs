#!/usr/bin/env node
/**
 * Shared-types drift gate — fails if generated contract artifacts are
 * stale relative to the Zod source files under
 * `packages/shared-types/src/ai-service/`.
 *
 * Pipeline:
 *   1. Regenerate JSON Schemas       → packages/shared-types/schemas/
 *   2. Regenerate Pydantic v2 models → apps/ai-service/ai_service/schemas/
 *      ([G2] — bilingual handoff used to be JSON Schema only; the
 *      Python side now ships executable pydantic models.)
 *   3. `git diff --exit-code` over BOTH output paths. Any diff means
 *      a Zod source changed without re-running the emitters — gate
 *      fails, shows the diff summary, exits 1.
 *
 * Invariant: the ai-service contract is current in EVERY representation
 * (Zod, JSON Schema, pydantic). A controller-side Zod change forces a
 * regen of both downstream artifacts on the same PR.
 *
 * Usage: pnpm shared-types:check
 *
 * Installed by [F3]; extended in [G2] to gate pydantic too.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const GATED_PATHS = ['packages/shared-types/schemas', 'apps/ai-service/ai_service/schemas'];

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
step('regenerating ai-service pydantic models', 'pnpm --filter=@app/shared-types pydantic:emit');

const diff = spawnSync('git', ['diff', '--stat', '--', ...GATED_PATHS], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (diff.status !== 0) {
  process.stderr.write(`[shared-types-check] git diff failed: ${diff.stderr}\n`);
  process.exit(1);
}

if (diff.stdout.trim().length === 0) {
  process.stdout.write('[shared-types-check] ✔ schemas + pydantic models are current.\n');
  process.exit(0);
}

process.stderr.write('\n[shared-types-check] ✘ DRIFT DETECTED — generated artifacts are stale.\n');
process.stderr.write('            A Zod source changed without running the emitters.\n\n');
process.stderr.write(diff.stdout);
process.stderr.write(
  '\nFix:\n' +
    '  pnpm --filter=@app/shared-types schemas:emit\n' +
    '  pnpm --filter=@app/shared-types pydantic:emit\n' +
    '  git add packages/shared-types/schemas apps/ai-service/ai_service/schemas\n' +
    '  pnpm shared-types:check   # confirm green\n',
);
process.exit(1);
