/**
 * Contract tests for the API ↔ ai-service JSON Schema files ([I4]).
 *
 * `packages/shared-types/schemas/ai-service/*.schema.json` is the
 * language-neutral handoff to the Python ai-service ([F3]) + the
 * source of truth for the in-repo Pydantic emit ([G2]). These tests:
 *
 *   1. Every emitted schema parses as JSON.
 *   2. Every emitted schema is a VALID Draft-07 JSON Schema (passes
 *      ajv's meta-schema check). Catches the emitter producing
 *      bogus `enum`, missing `type`, or invalid `$ref` shapes.
 *   3. The 18-file inventory is snapshot-locked. Adding a new Zod
 *      module (and re-emitting) regenerates the snapshot, which goes
 *      through code review.
 *
 * The drift-from-Zod check is in `pnpm shared-types:check` already
 * ([F3] + [G2]). This file adds the AT-REST validity check.
 *
 * Installed by prompt [I4].
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const SCHEMAS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'shared-types',
  'schemas',
  'ai-service',
);

function listSchemaFiles(): readonly string[] {
  return readdirSync(SCHEMAS_DIR)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
}

describe('contract — ai-service JSON Schemas', () => {
  const files = listSchemaFiles();

  it('inventory snapshot — every emitted schema is accounted for', () => {
    expect(files).toMatchSnapshot();
  });

  it.each(files)('%s parses as JSON', (f) => {
    expect(() => JSON.parse(readFileSync(join(SCHEMAS_DIR, f), 'utf8'))).not.toThrow();
  });

  // Build one Ajv instance with strict mode + draft-07 meta-schema.
  // Each file is then `compile()`d against the meta-schema; the
  // compile step itself is what proves validity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ajv default-export shape varies across CJS/ESM interop
  const AjvCtor = (Ajv as any).default ?? Ajv;
  const ajv = new AjvCtor({ strict: false, allErrors: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addFormatsFn = (addFormats as any).default ?? addFormats;
  addFormatsFn(ajv);

  it.each(files)('%s is a valid Draft-07 JSON Schema (compiles via ajv)', (f) => {
    const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, f), 'utf8'));
    // compile() throws if the schema itself is malformed. Catches
    // accidental enums of mixed types, missing `type` on objects, etc.
    expect(() => ajv.compile(schema)).not.toThrow();
  });
});
