/**
 * Count cross-module deep imports under apps/api/src/modules/.
 *
 * "Cross-module deep" = file A in module M_a imports file B in module
 * M_b (M_a !== M_b) AND B is not the barrel (`<M_b>/index.ts`).
 *
 * Used to size [B2]-[B5] burn-down. Throwaway — delete with the rest
 * in [B5].
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

const violations = [];
for (const file of walkTs(ROOT)) {
  const importerModule = path.relative(ROOT, file).split(path.sep)[0];
  const source = fs.readFileSync(file, 'utf8');
  for (const m of source.matchAll(IMPORT_RE)) {
    const rel = m[1];
    // Resolve relative to the importer file's directory.
    const resolved = path.normalize(path.join(path.dirname(file), rel));
    if (!resolved.startsWith(ROOT)) continue;
    const targetRel = path.relative(ROOT, resolved).split(path.sep);
    const targetModule = targetRel[0];
    if (targetModule === importerModule) continue;
    // Cross-module. Now check whether it hits the barrel.
    // The barrel resolution: `<root>/<m>` or `<root>/<m>/index`.
    const isBarrel = targetRel.length === 1 || (targetRel.length === 2 && targetRel[1] === 'index');
    if (isBarrel) continue;
    violations.push({
      importer: path.relative(ROOT, file).replace(/\\/g, '/'),
      importerModule,
      targetModule,
      targetTail: targetRel.slice(1).join('/'),
    });
  }
}

const byKey = new Map();
for (const v of violations) {
  const layer = v.targetTail.split('/')[0]; // domain / application / infrastructure / etc.
  const key = `${v.importerModule} -> ${v.targetModule}/${layer}`;
  byKey.set(key, (byKey.get(key) || 0) + 1);
}

const sorted = [...byKey.entries()].sort((a, b) => b[1] - a[1]);
console.log(`TOTAL cross-module deep imports: ${violations.length}`);
console.log(`\nBy importer -> targetModule/layer:`);
for (const [k, n] of sorted) console.log(`  ${n.toString().padStart(3)}  ${k}`);

console.log(`\nDistinct importing files: ${new Set(violations.map((v) => v.importer)).size}`);
