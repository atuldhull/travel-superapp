/**
 * Contract-drift fitness — fail CI if the ai-service prose contract
 * (`docs/services/ai-service/contract.md` §2) and the executable form
 * (`packages/shared-types/src/ai-service/`) disagree.
 *
 * The contract doc is the human-readable source of truth that
 * reviewers + the Python ai-service authors read; the Zod schemas
 * under `@app/shared-types/ai-service` are the machine-checked source
 * of truth that `apps/api` actually imports. If a schema lands in the
 * doc without showing up in code (or vice-versa), the two sides of
 * the boundary silently disagree.
 *
 * What this spec asserts:
 *   1. Every schema named in a fenced `ts` block in contract.md as
 *      `export const X = z.<...>` is also exported as a `const` from
 *      `@app/shared-types/src/ai-service/`.
 *   2. The package barrel (`ai-service/index.ts`) re-exports every
 *      sibling `*.ts` file in the directory — no orphaned schemas.
 *
 * Adding a new endpoint flow:
 *   - Add the `export const ...` in `contract.md`.
 *   - Mirror it in a new file under `packages/shared-types/src/ai-service/`.
 *   - Add the `export * from './new-file'` line to `index.ts`.
 *   - This spec stays green.
 *
 * Installed by prompt [A6.2] — architecture road-to-10.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const CONTRACT_MD = join(REPO_ROOT, 'docs', 'services', 'ai-service', 'contract.md');
const SCHEMAS_DIR = join(REPO_ROOT, 'packages', 'shared-types', 'src', 'ai-service');
const SCHEMAS_BARREL = join(SCHEMAS_DIR, 'index.ts');

/** Pull every fenced ```ts ... ``` block out of a markdown document. */
function tsFences(markdown: string): string[] {
  const out: string[] = [];
  // Match fenced blocks tagged `ts` (case-insensitive). The `(?:^|\n)`
  // anchor keeps us from matching ``` markers that sit mid-line.
  const re = /(?:^|\n)```ts\s*\n([\s\S]*?)\n```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

/** Pull every top-level `export const Name = z.<...>` schema name out
 *  of a TS source string. We anchor on `z.` to filter unrelated
 *  consts (numeric constants like `EMBEDDINGS_DIMENSIONS` aren't
 *  schemas and aren't required to appear in both sides). */
function zodSchemaExports(tsSource: string): string[] {
  const out: string[] = [];
  const re = /^export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*z\./gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tsSource)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

describe('contract-drift fitness — ai-service', () => {
  const md = readFileSync(CONTRACT_MD, 'utf8');
  const schemaFiles = readdirSync(SCHEMAS_DIR).filter((n) => n.endsWith('.ts') && n !== 'index.ts');

  // Union of every Zod schema exported from any sibling file in the
  // shared-types ai-service directory.
  const codeSchemas = new Set<string>();
  for (const file of schemaFiles) {
    const source = readFileSync(join(SCHEMAS_DIR, file), 'utf8');
    for (const name of zodSchemaExports(source)) {
      codeSchemas.add(name);
    }
  }

  // Every schema named in a ```ts``` fence in the contract doc.
  const docSchemas = new Set<string>();
  for (const fence of tsFences(md)) {
    for (const name of zodSchemaExports(fence)) {
      docSchemas.add(name);
    }
  }

  it('found ts fences in contract.md (smoke)', () => {
    expect(docSchemas.size).toBeGreaterThan(0);
  });

  it('found schema files in @app/shared-types/ai-service (smoke)', () => {
    expect(schemaFiles.length).toBeGreaterThan(0);
    expect(codeSchemas.size).toBeGreaterThan(0);
  });

  it('every Zod schema named in contract.md is exported from @app/shared-types/ai-service', () => {
    const missing = [...docSchemas].filter((name) => !codeSchemas.has(name));
    expect(missing).toEqual([]);
  });

  it('every sibling .ts file under ai-service/ is re-exported from index.ts', () => {
    const barrel = readFileSync(SCHEMAS_BARREL, 'utf8');
    const reExported = new Set<string>();
    const re = /export\s+\*\s+from\s+['"]\.\/([A-Za-z0-9_\-]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(barrel)) !== null) {
      reExported.add(m[1]!);
    }
    const orphans = schemaFiles
      .map((f) => basename(f, '.ts'))
      .filter((stem) => !reExported.has(stem));
    expect(orphans).toEqual([]);
  });
});
