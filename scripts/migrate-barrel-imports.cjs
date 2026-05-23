/**
 * One-shot migration for [B1] — module-boundaries hardening.
 *
 * Rewrites every cross-module import in `apps/api/src/modules/<A>/`
 * that points at another module's `<B>.module.ts` or
 * `<B>/application/ports/<port>.ts` so it goes through the new
 * `<B>/index.ts` barrel.
 *
 * Multi-line imports (`import {\n  Foo,\n  Bar,\n} from '...';`) are
 * supported. Multiple imports from the same other-module are merged
 * into a single consolidated statement (or split into two when both
 * value AND type-only imports exist for that target).
 *
 * Run from repo root:
 *     node scripts/migrate-barrel-imports.cjs
 *
 * Intentionally a throwaway — DELETE after B1 lands.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'apps', 'api', 'src', 'modules');

function* walkTs(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) yield* walkTs(abs);
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) yield abs;
  }
}

// Multi-line-friendly import matcher. Captures:
//   - typeOnly: presence of `type ` after `import`
//   - names:    everything inside the `{ ... }`
//   - relPath:  the `..` segments and the target module + tail
const IMPORT_RE =
  /import\s+(?<typeOnly>type\s+)?\{(?<names>[^}]+)\}\s+from\s+'(?<relPath>(?:\.\.\/){1,5}(?<targetModule>[a-z][a-z-]+)\/(?:(?<modFile>\k<targetModule>\.module)|application\/ports\/(?<portFile>[a-z][a-z0-9.-]+)))';?/gs;

let filesEdited = 0;
let importsRewritten = 0;

for (const file of walkTs(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep);
  const currentModule = rel[0];

  let source = fs.readFileSync(file, 'utf8');

  // Pass 1 — collect every cross-module barrel-target import.
  const matches = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    if (m.groups.targetModule === currentModule) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      typeOnly: !!m.groups.typeOnly,
      names: m.groups.names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      relPath: m.groups.relPath,
      targetModule: m.groups.targetModule,
    });
  }
  if (matches.length === 0) continue;

  // Group by (relPrefix without trailing tail, targetModule, typeOnly)
  // so two imports from the same module merge cleanly. The relPrefix
  // depth varies (e.g. `../` vs `../../`) — preserve whatever depth
  // the FIRST occurrence used; that's always correct since the
  // barrel sits one level above ports / siblings the module file.
  // Specifically: '../<m>/<m>.module' and '../../<m>/application/ports/X'
  // both become '<same-depth-prefix>/<m>' i.e. drop the trailing tail.
  const buckets = new Map();
  for (const m of matches) {
    const prefix = m.relPath.replace(
      // Strip the `<m>/<m>.module` or `<m>/application/ports/<port>` tail,
      // keeping the `..\..\` (etc.) plus the target module name.
      new RegExp(`(${m.targetModule})/(?:\\1\\.module|application/ports/[a-z0-9.-]+)$`),
      '$1',
    );
    const key = `${prefix}|${m.typeOnly ? 'T' : 'V'}`;
    let b = buckets.get(key);
    if (!b) {
      b = { prefix, typeOnly: m.typeOnly, names: new Set(), firstStart: m.start };
      buckets.set(key, b);
    }
    for (const n of m.names) b.names.add(n);
    b.firstStart = Math.min(b.firstStart, m.start);
  }

  // Build the replacement text per match (first hit per bucket = the
  // consolidated import; subsequent hits = empty).
  const seenBucket = new Set();
  // Rewrite in REVERSE so earlier offsets stay valid.
  matches.sort((a, b) => b.start - a.start);
  for (const m of matches) {
    const prefix = m.relPath.replace(
      new RegExp(`(${m.targetModule})/(?:\\1\\.module|application/ports/[a-z0-9.-]+)$`),
      '$1',
    );
    const key = `${prefix}|${m.typeOnly ? 'T' : 'V'}`;
    const b = buckets.get(key);
    let replacement;
    if (!seenBucket.has(key) && m.start === b.firstStart) {
      seenBucket.add(key);
      const head = b.typeOnly ? 'import type' : 'import';
      const names = [...b.names].sort().join(', ');
      replacement = `${head} { ${names} } from '${b.prefix}';`;
    } else {
      replacement = '';
    }
    source = source.slice(0, m.start) + replacement + source.slice(m.end);
  }

  // Clean up the blank lines left by deleted duplicate imports.
  source = source.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(file, source, 'utf8');
  filesEdited += 1;
  importsRewritten += matches.length;
}

console.log(`B1 migration: ${importsRewritten} imports rewritten across ${filesEdited} files`);
