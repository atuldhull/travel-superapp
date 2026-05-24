/**
 * Emit one JSON Schema per Zod schema in `src/ai-service/`.
 *
 * Output: `packages/shared-types/dist/ai-service/<schema>.schema.json`
 *
 * Why: the road-to-10 review called out that the NestJS↔FastAPI
 * boundary had no shared schema. Zod (the TS source of truth from
 * [A5]) doesn't have a Python equivalent, but JSON Schema does — it
 * is the language-neutral handoff. Once these files are emitted, the
 * Python side ([IV.18.2.11], future) can run datamodel-code-generator
 * over them to mint pydantic models with zero hand-coded drift:
 *
 *     datamodel-codegen \
 *       --input packages/shared-types/dist/ai-service \
 *       --input-file-type jsonschema \
 *       --output apps/ai-service/ai_service/schemas
 *
 * Run: `pnpm --filter=@app/shared-types schemas:emit`
 *
 * The drift gate (`pnpm shared-types:check`) regenerates and
 * `git diff --exit-code`s, identical posture to the SDK gate.
 *
 * Installed by [F3].
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src', 'ai-service');
const OUT_DIR = join(__dirname, '..', 'schemas', 'ai-service');

const SCHEMA_NAME = /^export\s+const\s+([A-Z][A-Za-z0-9]*)\s*=\s*z\./gm;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  let totalSchemas = 0;
  let totalFiles = 0;

  for (const file of files) {
    const moduleName = file.replace(/\.ts$/, '');
    // Dynamic import via tsx — we're in ESM context with node's TS
    // loader (the package is `"type": "module"`), so import the .ts
    // directly with the registered transpiler.
    const mod = await import(`../src/ai-service/${moduleName}.ts`);

    // Pull every `export const X = z.<...>` name out of the source
    // (filter for top-level Zod schemas — same shape the contract-
    // drift fitness spec uses).
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(join(SRC_DIR, file), 'utf8');
    const schemaNames = [...src.matchAll(SCHEMA_NAME)].map((m) => m[1]);

    for (const name of schemaNames) {
      const schema = mod[name];
      if (!schema || typeof schema !== 'object' || typeof schema.parse !== 'function') {
        process.stderr.write(`[emit-json-schemas] ${moduleName}.${name}: not a Zod schema; skip\n`);
        continue;
      }
      const json = zodToJsonSchema(schema, {
        name,
        target: 'jsonSchema7',
        $refStrategy: 'none',
      });
      const outPath = join(OUT_DIR, `${moduleName}.${name}.schema.json`);
      await writeFile(outPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
      totalSchemas += 1;
    }
    totalFiles += 1;
  }

  process.stdout.write(
    `[emit-json-schemas] wrote ${totalSchemas} JSON Schema files from ${totalFiles} Zod modules\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[emit-json-schemas] FAILED: ${err.message ?? err}\n`);
  process.exit(1);
});
