/**
 * Dump distinct importer files containing cross-module deep imports.
 * Throwaway — used to author the [B2] allowlist; delete in [B5].
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

const IMPORT_RE = /from\s+'((?:\.\.\/){1,8}[a-z0-9.\-_/]+)';?/g;
const set = new Set();
for (const file of walkTs(ROOT)) {
  const importerModule = path.relative(ROOT, file).split(path.sep)[0];
  const source = fs.readFileSync(file, 'utf8');
  for (const m of source.matchAll(IMPORT_RE)) {
    const rel = m[1];
    const resolved = path.normalize(path.join(path.dirname(file), rel));
    if (!resolved.startsWith(ROOT)) continue;
    const targetRel = path.relative(ROOT, resolved).split(path.sep);
    const targetModule = targetRel[0];
    if (targetModule === importerModule) continue;
    const isBarrel = targetRel.length === 1 || (targetRel.length === 2 && targetRel[1] === 'index');
    if (isBarrel) continue;
    set.add(path.relative(ROOT, file).split(path.sep).join('/'));
  }
}
console.log([...set].sort().join('\n'));
