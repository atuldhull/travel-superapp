#!/usr/bin/env node
/**
 * Codemod for [J1] — sweeps every `Date.now()`-suffixed identifier
 * pattern in `apps/api/test/*.ts` and rewrites it to a factory call
 * from `./factories`.
 *
 * Patterns it handles (specific → general; first match wins per line):
 *
 *   `${A}-${B}-${Date.now()}@example.com`
 *     → uniqueEmail(`${A}-${B}`)
 *
 *   `${LITERAL}-${Date.now()}@example.com`
 *     → uniqueEmail('LITERAL')
 *
 *   `${Date.now()}-${Math.random().toString(36).slice(2, N)}`
 *     → ${uniqueSuffix()}
 *
 *   `${Date.now()}` (standalone in a template literal)
 *     → ${uniqueSuffix()}
 *
 * On any rewrite, the file gets an `import { uniqueEmail,
 * uniqueSuffix } from './factories';` injected after the last
 * top-of-file import (if not already present).
 *
 * Run:
 *   node scripts/codemod-date-now.cjs           # apply
 *   node scripts/codemod-date-now.cjs --dry     # preview, no writes
 *
 * Installed by prompt [J1].
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'apps', 'api', 'test');
const DRY = process.argv.includes('--dry');

// Files we never touch:
const SKIP = new Set([
  'factories.unit.spec.ts',
  // The first-migration demo: already done correctly by hand.
  'account-delete.e2e-spec.ts',
]);

const LIST = fs
  .readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.ts') && !SKIP.has(f))
  .filter((f) => {
    const abs = path.join(TEST_DIR, f);
    return fs.statSync(abs).isFile();
  });

let touched = 0;
const summary = [];

for (const file of LIST) {
  const abs = path.join(TEST_DIR, file);
  const src = fs.readFileSync(abs, 'utf8');
  if (!src.includes('Date.now()')) continue;

  let next = src;
  const changes = [];

  // Pattern 1: `${A}-${B}-${Date.now()}@example.com`
  // Captures TWO ${...} groups + Date.now() + @example.com.
  next = next.replace(
    /`\$\{([A-Za-z_][A-Za-z0-9_]*)\}-\$\{([A-Za-z_][A-Za-z0-9_]*)\}-\$\{Date\.now\(\)\}@example\.com`/g,
    (_, a, b) => {
      changes.push(`uniqueEmail(\`${a}-${b}\`)`);
      return `uniqueEmail(\`\${${a}}-\${${b}}\`)`;
    },
  );

  // Pattern 2: `${LITERAL}-${Date.now()}@example.com`
  next = next.replace(
    /`([a-zA-Z][a-zA-Z0-9_-]*)-\$\{Date\.now\(\)\}@example\.com`/g,
    (_, literal) => {
      changes.push(`uniqueEmail('${literal}')`);
      return `uniqueEmail('${literal}')`;
    },
  );

  // Pattern 3: `${Date.now()}-${Math.random().toString(36).slice(2, N)}`
  // Drop in a single uniqueSuffix(). Greedy on the slice arg.
  next = next.replace(
    /\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,?\s*\d+\)\}/g,
    () => {
      changes.push('${uniqueSuffix()}');
      return '${uniqueSuffix()}';
    },
  );

  // Pattern 4: `${Date.now()}-${Math.random()}` (no slice form)
  next = next.replace(/\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\}/g, () => {
    changes.push('${uniqueSuffix()}');
    return '${uniqueSuffix()}';
  });

  // Pattern 5: bare ${Date.now()} inside a template literal.
  next = next.replace(/\$\{Date\.now\(\)\}/g, () => {
    changes.push('${uniqueSuffix()}');
    return '${uniqueSuffix()}';
  });

  if (next === src) continue;

  // Inject the factory import. Skip if the file already has it.
  const needsEmail = changes.some((c) => c.startsWith('uniqueEmail'));
  const needsSuffix = changes.some((c) => c.startsWith('${uniqueSuffix'));
  const importsToAdd = [];
  if (needsEmail && !/from\s+['"]\.\/factories['"]/.test(next)) {
    importsToAdd.push('uniqueEmail');
  }
  if (needsSuffix && !/from\s+['"]\.\/factories['"]/.test(next)) {
    if (!importsToAdd.includes('uniqueSuffix')) importsToAdd.push('uniqueSuffix');
  }
  // If already imported partially, augment the existing import.
  if (importsToAdd.length === 0 && /from\s+['"]\.\/factories['"]/.test(next)) {
    next = next.replace(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/factories['"];?/, (full, inside) => {
      const have = new Set(
        inside
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      if (needsEmail) have.add('uniqueEmail');
      if (needsSuffix) have.add('uniqueSuffix');
      const sorted = [...have].sort();
      return `import { ${sorted.join(', ')} } from './factories';`;
    });
  } else if (importsToAdd.length > 0) {
    // Inject after the last top-level import.
    const lines = next.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
      else if (lastImportIdx !== -1 && lines[i].trim().length > 0 && !lines[i].startsWith('//'))
        break;
    }
    const stmt = `import { ${importsToAdd.sort().join(', ')} } from './factories';`;
    if (lastImportIdx === -1) {
      // No imports at all — prepend.
      lines.unshift(stmt);
    } else {
      lines.splice(lastImportIdx + 1, 0, stmt);
    }
    next = lines.join('\n');
  }

  if (DRY) {
    summary.push(`would-touch: ${file} (${changes.length} rewrites)`);
  } else {
    fs.writeFileSync(abs, next, 'utf8');
    touched += 1;
    summary.push(`rewrote:    ${file} (${changes.length} rewrites)`);
  }
}

for (const line of summary) process.stdout.write(line + '\n');
process.stdout.write(
  `\n[codemod-date-now] ${DRY ? 'would touch' : 'touched'} ${DRY ? summary.length : touched} file(s).\n`,
);
