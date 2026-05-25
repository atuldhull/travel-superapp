#!/usr/bin/env node
/**
 * scripts/codemod-strip-dbreachable.cjs ([M4]) — strip the vestigial
 * `dbReachable` boolean from every integration spec.
 *
 * Why: pre-L1, every e2e spec wrapped its `beforeAll` in a try/catch
 * that set `dbReachable = false` when Postgres wasn't running, then
 * gated `app.close()` on it in `afterAll`. L1 made that defence
 * obsolete — globalSetup either uses the running Docker / CI services
 * or spins Testcontainers, so DB is ALWAYS reachable. The `dbReachable`
 * variable is dead code today; it triggered a lint error in M2's run
 * (no-unused-vars) and silently hides what a "failing" beforeAll
 * really means now (it crashes the suite — which is correct).
 *
 * Targets per file (idempotent — skips when already clean):
 *
 *   1. `  let dbReachable = true;`                 → DELETE entire line
 *   2. The full try/catch wrapper:
 *        try { <body> } catch (err) {
 *          const message = err instanceof Error ? err.message : String(err);
 *          // eslint-disable-next-line no-console
 *          console.warn(`... test: DB not reachable (${message}). Skipping.`);
 *          dbReachable = false;
 *        }
 *      → UNWRAP to just `<body>` at the original indent.
 *   3. `if (dbReachable) await app.close();`       → `await app.close();`
 *   4. `if (dbReachable) { … }` (multi-line)       → unwrap body
 *   5. `if (dbReachable) <single statement>;`      → `<statement>;`
 *   6. `if (!dbReachable) { return; }`             → DELETE block
 *      (relic L2's single-line codemod missed)
 *
 * Pass `--dry` for a diff preview without writing files.
 *
 * Installed by [M4].
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', 'apps', 'api', 'test');
const DRY = process.argv.includes('--dry');

/** Recursive .ts file walk. */
function* walkTs(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      yield* walkTs(abs);
    } else if (entry.endsWith('.ts')) {
      yield abs;
    }
  }
}

function stripDbReachable(source) {
  let out = source;

  // The three boolean names this codemod sweeps. `dbReachable` was the
  // original L1-era variant; later specs split into `infraReachable`
  // (db + redis + s3 combined probe) and `redisReachable` (redis-only).
  // All three share the same vestigial-after-L1 problem.
  const NAMES = ['dbReachable', 'infraReachable', 'redisReachable'];

  // NOTE on regex escaping: built via template literal → new RegExp(),
  // so each `\` in the pattern needs to survive both JS string parsing
  // AND regex parsing. A SINGLE `\` in the template literal becomes one
  // `\` in the resulting string, which the RegExp parser then sees as a
  // regex metacharacter. Double-backslashing here was a bug — `\\s`
  // would yield regex source `\\s`, which matches a literal `\s` pair
  // (not whitespace).
  for (const NAME of NAMES) {
    // 1) `let <NAME> = true;` line — delete whole line incl. trailing NL.
    out = out.replace(new RegExp(`^[ \\t]*let ${NAME} = true;[ \\t]*\\r?\\n`, 'gm'), '');

    // 2) try/catch unwrap — match `<NAME> = false;` as the structural sentinel.
    const tryRe = new RegExp(
      `([ \\t]*)try \\{\\r?\\n([\\s\\S]*?)\\r?\\n[ \\t]*\\} catch(?: \\([_a-zA-Z]\\w*\\))? \\{\\r?\\n[\\s\\S]*?[ \\t]*${NAME} = false;(?:\\r?\\n[ \\t]*return;)?\\r?\\n[ \\t]*\\}\\r?\\n`,
      'g',
    );
    out = out.replace(tryRe, (_match, indent, body) => {
      const innerIndent = indent + '  ';
      const dedented = body
        .split('\n')
        .map((line) => (line.startsWith(innerIndent) ? line.slice(2) : line))
        .join('\n');
      return `${dedented}\n`;
    });

    // 3) `if (<NAME>) await app.close();` → `await app.close();`
    out = out.replace(
      new RegExp(`^([ \\t]*)if \\(${NAME}\\) (await app\\.close\\(\\);)`, 'gm'),
      '$1$2',
    );

    // 4) Multi-line `if (<NAME>) { <body> }` → unwrap body.
    out = out.replace(
      new RegExp(`^([ \\t]*)if \\(${NAME}\\) \\{\\r?\\n([\\s\\S]*?)\\r?\\n[ \\t]*\\}\\r?\\n`, 'gm'),
      (_match, indent, body) => {
        const innerIndent = indent + '  ';
        const dedented = body
          .split('\n')
          .map((line) => (line.startsWith(innerIndent) ? line.slice(2) : line))
          .join('\n');
        return `${dedented}\n`;
      },
    );

    // 5) `if (<NAME>) <single statement>;`
    out = out.replace(new RegExp(`^([ \\t]*)if \\(${NAME}\\) ([^{].*;)\\s*$`, 'gm'), '$1$2');

    // 6a) `if (!<NAME>) { return; }` (multi-line block).
    out = out.replace(
      new RegExp(
        `^[ \\t]*if \\(!${NAME}\\) \\{\\r?\\n[ \\t]*return;\\r?\\n[ \\t]*\\}\\r?\\n`,
        'gm',
      ),
      '',
    );

    // 6b) `if (!<NAME>) return;` (single-line skip-pass). L2's codemod
    //     swept the `dbReachable` form; the `infraReachable` /
    //     `redisReachable` variants survived. Same dead code — delete.
    out = out.replace(new RegExp(`^[ \\t]*if \\(!${NAME}\\) return;[ \\t]*\\r?\\n`, 'gm'), '');
  }

  return out;
}

const NAMES_RE = /\b(dbReachable|infraReachable|redisReachable)\b/;

let changed = 0;
let leftover = [];
for (const file of walkTs(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  if (!NAMES_RE.test(before)) continue;
  const after = stripDbReachable(before);
  if (after === before) continue;
  if (NAMES_RE.test(after)) {
    leftover.push(path.relative(process.cwd(), file));
  }
  if (DRY) {
    process.stdout.write(`would patch: ${path.relative(process.cwd(), file)}\n`);
  } else {
    fs.writeFileSync(file, after);
  }
  changed += 1;
}

process.stdout.write(`${DRY ? 'WOULD patch' : 'patched'} ${changed} file(s)\n`);
if (leftover.length > 0) {
  process.stderr.write(
    `\n${leftover.length} file(s) still mention 'dbReachable' after the sweep — manual review:\n`,
  );
  for (const rel of leftover) process.stderr.write(`  - ${rel}\n`);
  process.exit(2);
}
