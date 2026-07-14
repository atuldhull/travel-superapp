#!/usr/bin/env node
/**
 * docs-env-check.cjs — drift gate between the Zod env schema and docs/env.md.
 *
 * Reads:
 *   - packages/config/src/schema.ts      (source of truth for env vars)
 *   - docs/env.md                        (the human reference table)
 *
 * Reports:
 *   - vars in schema.ts but missing from docs/env.md   (DOC THESE)
 *   - vars in docs/env.md but missing from schema.ts   (DEAD REFERENCES)
 *
 * Exits non-zero on any mismatch so CI fails — the env schema is the
 * source of truth, the doc must follow.
 *
 * Installed by [P6] of the Documentation 8.5→10 series.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'packages', 'config', 'src', 'schema.ts');
const docPath = path.join(repoRoot, 'docs', 'env.md');

if (!fs.existsSync(schemaPath)) {
  console.error(`✗ ${schemaPath} not found`);
  process.exit(2);
}
if (!fs.existsSync(docPath)) {
  console.error(`✗ ${docPath} not found`);
  process.exit(2);
}

// ─── Parse schema.ts ─────────────────────────────────────────────────────
// The schema is roughly:
//     export const EnvSchema = z.object({
//       NODE_ENV: z.enum([...]).default('development'),
//       PORT: z.coerce.number().default(3000),
//       ...
//     });
//
// We capture the keys of the z.object literal. The keys are uppercase /
// underscore — easy to grep for at indent depth 2 (two spaces, common
// prettier output). Be tolerant of tab indentation too.

const schemaSrc = fs.readFileSync(schemaPath, 'utf-8');

// Strip line + block comments so KEY: hits don't match inside example payloads.
const cleanSchema = schemaSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// Heuristic: an env var declaration line is `<indent><NAME>:` where NAME
// is UPPER_SNAKE_CASE, starts a line, indented by 2-8 spaces (inside the
// z.object literal).
const schemaVars = new Set();
for (const match of cleanSchema.matchAll(/^[ \t]{2,8}([A-Z][A-Z0-9_]*):/gm)) {
  schemaVars.add(match[1]);
}

if (schemaVars.size < 10) {
  console.error(
    `✗ only ${schemaVars.size} env vars parsed from schema.ts — regex is wrong, refusing to gate`,
  );
  process.exit(2);
}

// Single-word env vars that are also documented in env.md.
const ALLOWED_SHORT_NAMES = new Set(['PORT']);

// ─── Parse docs/env.md ────────────────────────────────────────────────────
// The doc has the env vars in code spans inside markdown tables, e.g.
//     | Runtime | `NODE_ENV` | … |
// We pull every `BACKTICKED_VAR` that looks like an env var name.
// Heuristic: env-var names tend to contain at least one underscore;
// single-word names go through ALLOWED_SHORT_NAMES.

const docSrc = fs.readFileSync(docPath, 'utf-8');
const docVars = new Set();
for (const match of docSrc.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)) {
  const name = match[1];
  if (name.includes('_') || ALLOWED_SHORT_NAMES.has(name)) {
    docVars.add(name);
  }
}

// ─── Diff ─────────────────────────────────────────────────────────────────

const missingFromDoc = [...schemaVars].filter((v) => !docVars.has(v)).sort();
const phantomInDoc = [...docVars].filter((v) => !schemaVars.has(v)).sort();

let problems = 0;

if (missingFromDoc.length > 0) {
  problems++;
  console.error('');
  console.error(`✗ ${missingFromDoc.length} env vars are in schema.ts but NOT in docs/env.md:`);
  for (const v of missingFromDoc) console.error(`    ${v}`);
  console.error('  → document them in docs/env.md (Required / Default / Validator / Notes).');
}

// Vars in docs but not schema: these are usually "documented but not yet
// implemented" or legacy. Allow a small allowlist.
const ALLOW_PHANTOMS = new Set([
  // Vars referenced in env.md prose / cross-refs that aren't actual env
  // vars (env names of OTHER services, Doppler internal names, etc.).
  'REPLACE_ME_SEE_DOPPLER',
  'PROD',
  'STAGING',
  // Workspace-level shell helpers documented for clarity.
  'CI',
]);
const realPhantoms = phantomInDoc.filter((v) => !ALLOW_PHANTOMS.has(v));

if (realPhantoms.length > 0) {
  problems++;
  console.error('');
  console.error(`✗ ${realPhantoms.length} env vars are in docs/env.md but NOT in schema.ts:`);
  for (const v of realPhantoms) console.error(`    ${v}`);
  console.error('  → remove them from docs/env.md, OR add them to schema.ts as optional.');
  console.error('     (If documented intentionally for "planned" status, add to ALLOW_PHANTOMS.)');
}

if (problems > 0) {
  console.error('');
  console.error(`✗ docs/env.md is out of sync with packages/config/src/schema.ts`);
  process.exit(1);
}

console.log(`✓ docs/env.md matches schema.ts (${schemaVars.size} env vars)`);
