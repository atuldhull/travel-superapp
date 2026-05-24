#!/usr/bin/env node
/**
 * One-shot fixer for [J1]'s codemod overreach: the factory-import
 * injection landed AFTER `import {` (the start of a multi-line
 * import) instead of after the closing `from '...'` line. This
 * walks every .ts under apps/api/test/, finds the malformed shape:
 *
 *   import {
 *   import { uniqueEmail } from './factories';
 *       FIELD_A,
 *       FIELD_B,
 *   } from '...';
 *
 * and rewrites it to:
 *
 *   import {
 *       FIELD_A,
 *       FIELD_B,
 *   } from '...';
 *   import { uniqueEmail } from './factories';
 *
 * Idempotent + no-op on files that already parse.
 */
const fs = require('node:fs');
const path = require('node:path');

const TEST_DIR = path.resolve(__dirname, '..', 'apps', 'api', 'test');
const FACTORY_IMPORT_RE = /^import\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]\.\/factories['"];?\s*$/;

let touched = 0;
for (const file of fs.readdirSync(TEST_DIR)) {
  if (!file.endsWith('.ts')) continue;
  const abs = path.join(TEST_DIR, file);
  if (!fs.statSync(abs).isFile()) continue;
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');

  // Find the malformed pattern. Look for lines matching the factory
  // import that have an immediately-PRECEDING line of `import {` (no
  // closing brace on the same line).
  const factoryIndices = [];
  for (let i = 0; i < lines.length; i++) {
    if (FACTORY_IMPORT_RE.test(lines[i])) factoryIndices.push(i);
  }
  let mutated = false;
  const factoryStmts = [];
  // Walk indices in reverse so splicing earlier ones doesn't shift later ones.
  for (const idx of factoryIndices.slice().reverse()) {
    const prev = lines[idx - 1];
    if (!prev) continue;
    // Pattern: prev line ends with `{` (a multi-line import starting)
    // AND has no `}` in it. That means the factory import is inside
    // the middle of a multi-line import block.
    // Also match `import type {` start of multi-line type-only imports.
    if (/^import\s+(type\s+)?\{\s*$/.test(prev)) {
      mutated = true;
      const stmt = lines[idx];
      factoryStmts.unshift(stmt);
      lines.splice(idx, 1);
    }
  }
  if (!mutated) continue;

  // Find the last top-of-file import (the closing `from '...';` line)
  // and re-append the factory imports after it.
  let lastImportEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i]) && /from\s+['"][^'"]+['"];?\s*$/.test(lines[i])) {
      lastImportEnd = i;
    } else if (
      lastImportEnd !== -1 &&
      lines[i].trim().length > 0 &&
      !/^import\s/.test(lines[i]) &&
      !/^\s*\}\s*from/.test(lines[i]) &&
      !lines[i].startsWith('//') &&
      !/^\s+/.test(lines[i])
    ) {
      // Hit non-import top-level — stop scanning.
      break;
    } else if (/^\s*\}\s*from\s+['"][^'"]+['"];?\s*$/.test(lines[i])) {
      lastImportEnd = i;
    }
  }
  if (lastImportEnd === -1) {
    // Shouldn't happen, but bail safely.
    fs.writeFileSync(abs, src, 'utf8');
    continue;
  }
  lines.splice(lastImportEnd + 1, 0, ...factoryStmts);
  fs.writeFileSync(abs, lines.join('\n'), 'utf8');
  touched += 1;
  process.stdout.write(`fixed: ${file}\n`);
}
process.stdout.write(`\n[fix-broken-imports] fixed ${touched} file(s).\n`);
