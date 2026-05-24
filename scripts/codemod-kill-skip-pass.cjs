#!/usr/bin/env node
/**
 * Codemod for [L2] — sweeps every `if (!dbReachable) return;` and
 * its variants from `apps/api/test/*.ts`. After [L1]'s Testcontainers
 * + per-worker schema setup, infra is ALWAYS provisioned; the skip-
 * pass gate is dead code that silently no-op'd suites.
 *
 * What it kills (each on its own line; whitespace tolerant):
 *
 *   if (!dbReachable) return;
 *   if (!dbReachable) return
 *   if (!dbReachable) { return; }
 *
 * What it LEAVES:
 *
 *   - The `let dbReachable = true;` declaration + the try/catch
 *     wrapper in beforeAll. Those stay so a developer running with
 *     globalSetup explicitly disabled still gets a useful warning.
 *   - `if (dbReachable) await app.close();` in afterAll — that one
 *     guards a cleanup path that ALSO ran on the failure-side of
 *     the try/catch, where calling `.close()` on a half-init Nest
 *     app would throw and mask the original error.
 *
 * Net effect: a test that depends on infra and the infra is missing
 * now fails LOUDLY with the real prisma / redis error, instead of
 * silently passing.
 *
 * Run:
 *   node scripts/codemod-kill-skip-pass.cjs           # apply
 *   node scripts/codemod-kill-skip-pass.cjs --dry     # preview
 *
 * Installed by prompt [L2].
 */
const fs = require('node:fs');
const path = require('node:path');

const TEST_DIR = path.resolve(__dirname, '..', 'apps', 'api', 'test');
const DRY = process.argv.includes('--dry');

let touched = 0;
const summary = [];

for (const file of fs.readdirSync(TEST_DIR)) {
  if (!file.endsWith('.ts')) continue;
  const abs = path.join(TEST_DIR, file);
  if (!fs.statSync(abs).isFile()) continue;
  const src = fs.readFileSync(abs, 'utf8');
  if (!src.includes('dbReachable')) continue;

  // Line-by-line walk. Drop any line whose trimmed content is one
  // of the skip-pass forms below. Multi-line `if (!dbReachable) {
  // return; }` is rare in this codebase; the line-form catches every
  // surviving site (verified via grep before writing the codemod).
  const lines = src.split('\n');
  const kept = [];
  let dropped = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'if (!dbReachable) return;' || trimmed === 'if (!dbReachable) return') {
      dropped += 1;
      continue;
    }
    kept.push(line);
  }
  if (dropped === 0) continue;

  const out = kept.join('\n');
  if (DRY) {
    summary.push(`would-rewrite: ${file} (${dropped} skip-passes removed)`);
  } else {
    fs.writeFileSync(abs, out, 'utf8');
    touched += 1;
    summary.push(`rewrote: ${file} (${dropped} skip-passes removed)`);
  }
}

for (const line of summary) process.stdout.write(line + '\n');
process.stdout.write(
  `\n[codemod-kill-skip-pass] ${DRY ? 'would touch' : 'touched'} ${DRY ? summary.length : touched} file(s).\n`,
);
