#!/usr/bin/env node
/**
 * scripts/codemod-inject-clock.cjs ([M6]) — wire CLOCK into every Nest
 * @Injectable / @Controller / @Catch class under apps/api/src that
 * currently calls `new Date()` or `Date.now()` directly.
 *
 * Why: [M2] shipped the global ClockModule + migrated 3 representative
 * use-cases. 81 sites under apps/api/src/{modules,common} still used
 * the raw `new Date()` / `Date.now()` — the seam was live but most
 * production code didn't go through it. The user's review item #6
 * said "control time EVERYWHERE"; this codemod completes that ask
 * for every Nest-managed class.
 *
 * Per file:
 *
 *   1. Skip if file doesn't have @Injectable / @Controller / @Catch.
 *   2. Skip if file has no constructor (e.g., a class with only
 *      static methods and no DI-wired state).
 *   3. Skip if `@app/clock` is already imported (idempotent).
 *   4. Inject the import:
 *        - `import { CLOCK, type Clock } from '@app/clock';`
 *        - Add `Inject` to the `@nestjs/common` import if missing.
 *   5. Add `@Inject(CLOCK) private readonly clock: Clock,` as a
 *      constructor parameter. Inserted as the LAST parameter, before
 *      the closing `)` of the constructor's argument list, with the
 *      same indentation as the existing parameters.
 *   6. Substitute every `new Date()` → `this.clock.now()` and
 *      `Date.now()` → `this.clock.nowMs()` in the file.
 *
 * Substitution only touches the empty-args forms — `new Date(x)`,
 * `Date.now`, etc. are untouched. The substitution is done line-by-
 * line to keep the diff minimal.
 *
 * Caveats handled afterward (manual fixup if typecheck complains):
 *   - Static method using `this.clock` (rare; controllers + use-cases
 *     don't typically have those).
 *   - Method called before `constructor` ran (none observed in this
 *     repo — Nest enforces DI completion before route binding).
 *
 * Pass `--dry` for a preview without writing.
 *
 * Installed by [M6].
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOTS = [
  path.resolve(__dirname, '..', 'apps', 'api', 'src', 'modules'),
  path.resolve(__dirname, '..', 'apps', 'api', 'src', 'common'),
];
const DRY = process.argv.includes('--dry');

/** Recursive .ts walk. */
function* walkTs(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      yield* walkTs(abs);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      yield abs;
    }
  }
}

/** Returns true if `src` declares an @Injectable / @Controller / @Catch. */
function isNestManagedClass(src) {
  return /^[ \t]*@(?:Injectable|Controller|Catch)\b/m.test(src);
}

/** Find the Nest-managed class body (the one decorated with
 *  @Injectable / @Controller / @Catch). Returns the substring
 *  positions [classStart, classEnd] enclosing the `{ ... }` block
 *  of the class, or `null` if no such class exists in `src`.
 *
 *  Why we need this: a file like `login.use-case.ts` declares an
 *  `AccountBannedError` (an Error subclass) AND a `LoginUseCase`
 *  (the @Injectable). The first `constructor(` in the file belongs
 *  to AccountBannedError — adding `@Inject(CLOCK)` to that one is
 *  wrong (Error classes don't go through Nest DI). Scoping the
 *  search to the @Injectable class body fixes the misattribution.
 */
function findManagedClassBody(src) {
  // Locate the decorator + the class keyword that follows it.
  // The decorator may be `@Injectable()` (with parens) or
  // `@Controller('/path')` (with arg).
  const decoratorRe = /^[ \t]*@(Injectable|Controller|Catch)\b[^\n]*\n/gm;
  let m;
  while ((m = decoratorRe.exec(src)) !== null) {
    // After the decorator line(s), look for `class <Name>` on the
    // next non-blank, non-decorator, non-export-leadin line. The
    // class keyword may sit on a line that starts with `export `.
    let cursor = m.index + m[0].length;
    // Skip stacked decorators (e.g., @Injectable() + @UseGuards()).
    while (/^[ \t]*@/.test(src.slice(cursor))) {
      const nl = src.indexOf('\n', cursor);
      if (nl === -1) return null;
      cursor = nl + 1;
    }
    // Now expect `export class X` or `class X`.
    const head = src.slice(cursor).match(/^(?:export\s+)?(?:abstract\s+)?class\s+\w+[^{]*\{/);
    if (!head) continue;
    const classOpen = cursor + head[0].length - 1; // position of `{`
    // Naive brace-balance to find the matching `}`.
    //
    // We DELIBERATELY ignore strings, template literals, regex literals
    // and comments. A previous "smart" string-skip implementation got
    // confused by regex literals like `/"/g` — it entered "string mode"
    // at the spurious `"` inside the regex pattern and read forward
    // until the next `"` (often hundreds of chars later, in an
    // unrelated literal), throwing the depth off by 2.
    //
    // The naive scan is correct as long as `{` and `}` chars appearing
    // inside strings/comments/regexes balance out within the class
    // body. That holds for every file in this codebase today (template
    // literals use `${...}` which balances; HTML strings don't contain
    // raw braces; regex literals don't use `{` or `}` quantifiers).
    let depth = 1;
    let i = classOpen + 1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue;
    return { start: classOpen, end: i };
  }
  return null;
}

/** Find the constructor's argument list WITHIN the given range
 *  `[startIdx, endIdx]`. Returns `{ open, close, indent, paramsRaw }`
 *  or `null`. The `close` points at the closing `)` so we can splice
 *  in a new parameter just before it. */
function findConstructor(src, startIdx, endIdx) {
  const slice = src.slice(startIdx, endIdx);
  const re = /(\n[ \t]*)constructor\(/g;
  const m = re.exec(slice);
  if (!m) return null;
  const indent = m[1].slice(1);
  const open = startIdx + m.index + m[0].length - 1; // global position of `(`
  // Naive paren-balance (see findManagedClassBody for the rationale).
  let depth = 1;
  let i = open + 1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  return {
    open,
    close: i,
    indent,
    paramsRaw: src.slice(open + 1, i),
  };
}

/** Add `Inject` to the existing `import {...} from '@nestjs/common'`
 *  line, if it isn't already there. Returns the modified source. */
function ensureInjectImport(src) {
  if (/@Inject\s*\(\s*CLOCK\s*\)/.test(src) && /\bInject\b.*from '@nestjs\/common'/s.test(src)) {
    return src;
  }
  // Find the `@nestjs/common` import line.
  const m = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]@nestjs\/common['"];?/);
  if (!m) return src;
  const names = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.includes('Inject')) return src;
  names.push('Inject');
  // Re-sort alphabetically — matches the codebase convention.
  names.sort((a, b) => a.localeCompare(b));
  const replacement = `import { ${names.join(', ')} } from '@nestjs/common';`;
  return src.replace(m[0], replacement);
}

/** Add `import { CLOCK, type Clock } from '@app/clock';` after the
 *  first existing `@app/*` or `@nestjs/*` import. */
function ensureClockImport(src) {
  if (/from\s+['"]@app\/clock['"]/.test(src)) return src;
  // Place the new import after the LAST `@nestjs/*` or `@app/*` import
  // — keeps the import block grouped by source.
  const lines = src.split('\n');
  let insertAt = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^import .* from ['"]@(?:nestjs|app)\//.test(lines[i])) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) {
    // No @app/@nestjs import — insert after the first import line.
    for (let i = 0; i < lines.length; i++) {
      if (/^import /.test(lines[i])) {
        insertAt = i + 1;
        break;
      }
    }
  }
  if (insertAt === -1) return src;
  lines.splice(insertAt, 0, `import { CLOCK, type Clock } from '@app/clock';`);
  return lines.join('\n');
}

/** Returns `null` if no transform was applied. */
function migrate(src) {
  if (!isNestManagedClass(src)) return null;
  if (!/new Date\(\)|Date\.now\(\)/.test(src)) return null;
  const body = findManagedClassBody(src);
  if (!body) return null;
  const ctor = findConstructor(src, body.start, body.end);
  if (!ctor) return null;

  // Only do the substitution if the `new Date()` / `Date.now()` call
  // sites are INSIDE the managed class body. If they're in a
  // co-located helper or another (Error / DTO) class, leave them.
  const beforeClass = src.slice(0, body.start);
  const inClass = src.slice(body.start, body.end);
  const afterClass = src.slice(body.end);
  if (!/new Date\(\)|Date\.now\(\)/.test(inClass)) {
    // The call sites are outside the managed class body — leave it
    // alone; manual migration handles those.
    return null;
  }

  let out = src;

  // Add a `@Inject(CLOCK) private readonly clock: Clock,` parameter
  // unless it's already there.
  const paramsAlreadyHasClock = /@Inject\(CLOCK\)/.test(ctor.paramsRaw);
  if (!paramsAlreadyHasClock) {
    // Trim trailing whitespace from existing params; re-insert with a
    // trailing comma if the last char is non-empty + not a comma.
    const trimmed = ctor.paramsRaw.replace(/\s+$/, '');
    const sep = trimmed.length === 0 || trimmed.endsWith(',') ? '' : ',';
    const newParam = `\n${ctor.indent}  @Inject(CLOCK) private readonly clock: Clock,`;
    // Pull the original trailing whitespace (likely a newline + indent
    // before `)`) and re-attach it after our new parameter so the `)`
    // sits at the same column.
    const trailingWs = ctor.paramsRaw.slice(trimmed.length);
    const newParams = `${trimmed}${sep}${newParam}${trailingWs}`;
    out = out.slice(0, ctor.open + 1) + newParams + out.slice(ctor.close);
  }

  // Add the imports.
  out = ensureClockImport(out);
  out = ensureInjectImport(out);

  // Substitute every `new Date()` → `this.clock.now()` and
  // `Date.now()` → `this.clock.nowMs()` — but only inside the managed
  // class body. Recompute body bounds after the constructor insert.
  const body2 = findManagedClassBody(out);
  if (!body2) return null;
  const head = out.slice(0, body2.start);
  let mid = out.slice(body2.start, body2.end);
  const tail = out.slice(body2.end);
  mid = mid.replace(/\bnew Date\(\)/g, 'this.clock.now()');
  mid = mid.replace(/\bDate\.now\(\)/g, 'this.clock.nowMs()');
  out = head + mid + tail;

  return out;
}

let touched = 0;
let skipped = 0;
const errors = [];
for (const root of ROOTS) {
  for (const file of walkTs(root)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = migrate(before);
    if (after === null) {
      if (/new Date\(\)|Date\.now\(\)/.test(before)) skipped++;
      continue;
    }
    const rel = path.relative(process.cwd(), file);
    if (DRY) {
      process.stdout.write(`would patch: ${rel}\n`);
    } else {
      fs.writeFileSync(file, after);
      process.stdout.write(`patched: ${rel}\n`);
    }
    touched++;
  }
}
process.stdout.write(
  `\n${DRY ? 'WOULD patch' : 'patched'} ${touched} file(s); ${skipped} non-class file(s) deferred to manual migration.\n`,
);
if (errors.length > 0) {
  for (const e of errors) process.stderr.write(`  ! ${e}\n`);
  process.exit(2);
}
