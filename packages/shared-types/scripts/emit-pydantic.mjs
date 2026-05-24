/**
 * Emit Pydantic v2 models from the tracked JSON Schemas under
 * `packages/shared-types/schemas/ai-service/`.
 *
 * Output: `apps/ai-service/ai_service/schemas/<module>.py` + a
 * sibling `__init__.py` that re-exports the public names.
 *
 * Why: [F3] gave us JSON Schema as the language-neutral handoff, but
 * the Python side was still scaffold-only — the contract isn't
 * actually executable on the Python boundary until `Translate
 * Request` etc. exist as importable pydantic models. The original
 * plan called this out as deferred until `[IV.18.2.11]` builds the
 * ai-service. [G2] does it now, NODE-side, so a tooled checkout (no
 * Python required) still gets a hermetic regen + drift gate.
 *
 * We do not shell out to `datamodel-code-generator` (Python tool)
 * because Python isn't a host dependency on this project; a Node-
 * resident emitter keeps `pnpm shared-types:check` self-contained.
 *
 * SCOPE — supports the JSON Schema subset that today's Zod schemas
 *   produce (zod-to-json-schema with `$refStrategy: 'none'`):
 *     - string  (minLength, maxLength, format=date-time, const, enum)
 *     - integer (minimum, maximum, exclusiveMinimum, const)
 *     - number  (minimum, maximum, const)
 *     - boolean
 *     - object  (properties + required + additionalProperties: false)
 *     - array   (items, minItems, maxItems)
 *     - anyOf   (Union[...])
 *   Anything else fails LOUDLY — adding a new construct is a one-line
 *   change but must be intentional, not a silent fallback to `Any`.
 *
 * Run: `pnpm --filter=@app/shared-types pydantic:emit`
 *
 * Installed by prompt [G2].
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_DIR = join(__dirname, '..', 'schemas', 'ai-service');
const OUT_DIR = join(__dirname, '..', '..', '..', 'apps', 'ai-service', 'ai_service', 'schemas');

// ─────────────────────────────────────────────────────────────────────
// Emitter
// ─────────────────────────────────────────────────────────────────────

/** Collected sibling classes (enums + nested objects) emitted BEFORE
 *  the top-level class that referenced them. Reset per top-level
 *  schema. */
class EmitContext {
  constructor(topName, moduleEnumDict) {
    this.topName = topName;
    /** Lines for sibling classes (Enum / nested BaseModel) that the
     *  top-level class depends on, in dependency order. */
    this.preludes = [];
    /** `datetime` / `Literal` / `Union` import flags. */
    this.imports = new Set();
    /** Auto-counter for unnamed nested objects. */
    this.nestedCounter = 0;
    /** Module-scoped enum dedupe: a sorted-values key → top-level
     *  enum name already declared elsewhere in this module file. Lets
     *  `TranslateRequest.domain: TranslateDomain` re-use the public
     *  enum instead of fabricating a `TranslateRequestDomain` clone. */
    this.moduleEnumDict = moduleEnumDict;
  }

  /** Allocate a stable name for an inline nested object: e.g.
   *  `AiServiceHealthResponseRay` for `ray:` inside
   *  `AiServiceHealthResponse`. Falls back to a numeric suffix if no
   *  field name is in scope. */
  nestedName(fieldName) {
    if (fieldName) {
      const cap = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      return `${this.topName}${cap}`;
    }
    this.nestedCounter += 1;
    return `${this.topName}Nested${this.nestedCounter}`;
  }
}

/** Translate one JSON Schema `definitions.X` node into a Pydantic
 *  type expression + accumulate sibling classes into `ctx.preludes`. */
function emitType(schema, ctx, fieldName) {
  // anyOf / union
  if (Array.isArray(schema.anyOf)) {
    ctx.imports.add('Union');
    const parts = schema.anyOf.map((sub, i) => {
      // `{}` (zero-key object) means "no constraint" → emit `Any`.
      // z.instanceof(Uint8Array) produces this; the wire form on
      // Python is `bytes`, so map to that explicitly rather than Any.
      if (sub && typeof sub === 'object' && Object.keys(sub).length === 0) {
        return 'bytes';
      }
      return emitType(sub, ctx, `${fieldName ?? 'value'}Variant${i + 1}`);
    });
    return `Union[${parts.join(', ')}]`;
  }

  if (schema.type === 'string') {
    if (schema.const !== undefined) {
      ctx.imports.add('Literal');
      return `Literal[${JSON.stringify(schema.const)}]`;
    }
    if (Array.isArray(schema.enum)) {
      // First check the module-level enum dictionary — if the same
      // value set is already a public enum (e.g. TranslateDomain),
      // reference it instead of cloning a nested duplicate.
      const key = [...schema.enum].sort().join('|');
      const existing = ctx.moduleEnumDict.get(key);
      if (existing) return existing;
      // Lift to a sibling Enum class so callers get autocomplete + the
      // wire format stays as the bare string.
      const enumName = ctx.nestedName(fieldName);
      ctx.preludes.push(emitStringEnum(enumName, schema.enum));
      ctx.moduleEnumDict.set(key, enumName); // future inline matches reuse
      return enumName;
    }
    if (schema.format === 'date-time') {
      ctx.imports.add('datetime');
      return 'datetime';
    }
    return 'str';
  }

  if (schema.type === 'integer') {
    if (schema.const !== undefined) {
      ctx.imports.add('Literal');
      return `Literal[${schema.const}]`;
    }
    return 'int';
  }

  if (schema.type === 'number') {
    if (schema.const !== undefined) {
      ctx.imports.add('Literal');
      return `Literal[${schema.const}]`;
    }
    return 'float';
  }

  if (schema.type === 'boolean') return 'bool';

  if (schema.type === 'array') {
    const inner = emitType(schema.items, ctx, fieldName);
    return `list[${inner}]`;
  }

  if (schema.type === 'object') {
    const name = ctx.nestedName(fieldName);
    ctx.preludes.push(emitObject(name, schema, ctx));
    return name;
  }

  throw new Error(
    `[emit-pydantic] unsupported JSON Schema node for ${ctx.topName}.${fieldName}: ${JSON.stringify(schema)}`,
  );
}

function emitStringEnum(name, values) {
  ctx_assertEnumIdentifierSafe(values);
  const members = values.map((v) => `    ${v} = ${JSON.stringify(v)}`).join('\n');
  return `class ${name}(str, Enum):\n${members}`;
}

/** Pydantic emits enum members as Python identifiers; the wire value
 *  is the assigned string. We only support `[a-z][a-z0-9_]*` enum
 *  members — every current ai-service enum satisfies that. */
function ctx_assertEnumIdentifierSafe(values) {
  for (const v of values) {
    if (!/^[a-z][a-zA-Z0-9_]*$/.test(v)) {
      throw new Error(
        `[emit-pydantic] enum value "${v}" is not a Python identifier; the emitter does not support quoted/spaced enum members yet.`,
      );
    }
  }
}

function emitObject(name, schema, ctx) {
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};
  const fields = [];
  for (const [propName, propSchema] of Object.entries(props)) {
    const pyType = emitType(propSchema, ctx, propName);
    const fieldArgs = collectFieldArgs(propSchema);
    const isRequired = required.has(propName);
    const annotated = isRequired ? pyType : `Optional[${pyType}]`;
    if (!isRequired) ctx.imports.add('Optional');

    if (fieldArgs.length === 0) {
      // No constraint metadata; bare default suffices.
      const defaultExpr = isRequired ? '' : ' = None';
      fields.push(`    ${propName}: ${annotated}${defaultExpr}`);
    } else {
      ctx.imports.add('Field');
      const defaultArg = isRequired ? '...' : 'None';
      fields.push(`    ${propName}: ${annotated} = Field(${defaultArg}, ${fieldArgs.join(', ')})`);
    }
  }

  // ConfigDict(extra='forbid') == JSON Schema additionalProperties:false.
  const extraForbid =
    schema.additionalProperties === false
      ? `    model_config = ConfigDict(extra='forbid')\n\n`
      : '';

  const body = extraForbid + (fields.length > 0 ? fields.join('\n') : '    pass');
  return `class ${name}(BaseModel):\n${body}`;
}

/** Map JSON-Schema validator keywords onto `pydantic.Field` kwargs. */
function collectFieldArgs(schema) {
  const args = [];
  if (typeof schema.minLength === 'number') {
    args.push(`min_length=${schema.minLength}`);
  }
  if (typeof schema.maxLength === 'number') {
    args.push(`max_length=${schema.maxLength}`);
  }
  if (schema.type === 'array') {
    if (typeof schema.minItems === 'number') args.push(`min_length=${schema.minItems}`);
    if (typeof schema.maxItems === 'number') args.push(`max_length=${schema.maxItems}`);
  }
  if (typeof schema.minimum === 'number') args.push(`ge=${schema.minimum}`);
  if (typeof schema.maximum === 'number') args.push(`le=${schema.maximum}`);
  if (typeof schema.exclusiveMinimum === 'number') args.push(`gt=${schema.exclusiveMinimum}`);
  if (typeof schema.exclusiveMaximum === 'number') args.push(`lt=${schema.exclusiveMaximum}`);
  return args;
}

// ─────────────────────────────────────────────────────────────────────
// File assembly
// ─────────────────────────────────────────────────────────────────────

function assembleModuleFile(moduleName, schemas) {
  // Render every top-level schema first so we collect all preludes
  // and import requirements, then prepend the header.
  const renderedTopLevels = [];
  const preludes = [];
  const imports = new Set();

  // Seed the dedupe dict with every TOP-LEVEL string-enum in this
  // module so inline references (`TranslateRequest.domain`) reuse the
  // public name (`TranslateDomain`).
  const moduleEnumDict = new Map();
  for (const { name, definition } of schemas) {
    if (definition.type === 'string' && Array.isArray(definition.enum)) {
      moduleEnumDict.set([...definition.enum].sort().join('|'), name);
    }
  }

  for (const { name, definition } of schemas) {
    const ctx = new EmitContext(name, moduleEnumDict);
    const topLevel = (() => {
      if (definition.type === 'object') return emitObject(name, definition, ctx);
      if (definition.type === 'string' && Array.isArray(definition.enum)) {
        return emitStringEnum(name, definition.enum);
      }
      // Anything else as a top-level export would just be a type alias.
      const t = emitType(definition, ctx, name);
      return `${name} = ${t}`;
    })();
    preludes.push(...ctx.preludes);
    for (const i of ctx.imports) imports.add(i);
    renderedTopLevels.push(topLevel);
  }

  const headerLines = [
    `"""`,
    `Pydantic models for ai-service module \`${moduleName}\`.`,
    ``,
    `AUTOGENERATED by packages/shared-types/scripts/emit-pydantic.mjs —`,
    `DO NOT EDIT. Regenerate with \`pnpm --filter=@app/shared-types pydantic:emit\`.`,
    ``,
    `Drift-gated by \`pnpm shared-types:check\` (CI \`arch\` job).`,
    `"""`,
  ];

  const importLines = ['from __future__ import annotations'];
  if (imports.has('datetime')) importLines.push('from datetime import datetime');
  const typing = [];
  if (imports.has('Literal')) typing.push('Literal');
  if (imports.has('Optional')) typing.push('Optional');
  if (imports.has('Union')) typing.push('Union');
  if (typing.length > 0) importLines.push(`from typing import ${typing.join(', ')}`);
  // Need `Enum` import if any class in the file extends `(str, Enum)`,
  // whether emitted as a sibling prelude or a top-level export.
  const hasAnyEnum = [...preludes, ...renderedTopLevels].some(
    (p) => p.startsWith('class ') && p.includes('(str, Enum):'),
  );
  if (hasAnyEnum) importLines.push('from enum import Enum');
  const pydanticImports = ['BaseModel', 'ConfigDict'];
  if (imports.has('Field')) pydanticImports.push('Field');
  importLines.push(`from pydantic import ${pydanticImports.join(', ')}`);

  const sections = [
    headerLines.join('\n'),
    importLines.join('\n'),
    ...preludes,
    ...renderedTopLevels,
  ];
  return sections.join('\n\n\n') + '\n';
}

function assembleInitFile(byModule) {
  const lines = [
    `"""`,
    `Re-export every Pydantic model emitted from`,
    `\`packages/shared-types/schemas/ai-service/\`.`,
    ``,
    `AUTOGENERATED by packages/shared-types/scripts/emit-pydantic.mjs —`,
    `DO NOT EDIT.`,
    `"""`,
    ``,
  ];
  const all = [];
  for (const [moduleName, schemas] of byModule) {
    const names = schemas.map((s) => s.name).sort();
    lines.push(`from .${pyModule(moduleName)} import ${names.join(', ')}`);
    all.push(...names);
  }
  lines.push('');
  lines.push(`__all__ = [`);
  for (const n of all.sort()) lines.push(`    ${JSON.stringify(n)},`);
  lines.push(`]`);
  return lines.join('\n') + '\n';
}

/** `fake-review` (the module file name on disk) → `fake_review` (the
 *  Python module identifier). */
function pyModule(moduleName) {
  return moduleName.replace(/-/g, '_');
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  // Wipe + recreate so a removed source schema doesn't leave a stale
  // .py file behind that the drift gate would never catch.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(IN_DIR)).filter((f) => f.endsWith('.schema.json'));
  const byModule = new Map();
  for (const file of files) {
    const [moduleName, name] = file.replace(/\.schema\.json$/, '').split('.');
    if (!moduleName || !name) {
      throw new Error(`[emit-pydantic] unexpected filename "${file}"`);
    }
    const raw = JSON.parse(await readFile(join(IN_DIR, file), 'utf8'));
    // Files use `{ $ref, definitions: { [name]: { ... } } }` shape;
    // strip the outer wrapper.
    const definition = raw.definitions?.[name];
    if (!definition) throw new Error(`[emit-pydantic] ${file}: no definitions.${name}`);
    if (!byModule.has(moduleName)) byModule.set(moduleName, []);
    byModule.get(moduleName).push({ name, definition });
  }

  let totalFiles = 0;
  let totalSchemas = 0;
  for (const [moduleName, schemas] of byModule) {
    schemas.sort((a, b) => a.name.localeCompare(b.name));
    const text = assembleModuleFile(moduleName, schemas);
    await writeFile(join(OUT_DIR, `${pyModule(moduleName)}.py`), text, 'utf8');
    totalFiles += 1;
    totalSchemas += schemas.length;
  }

  await writeFile(join(OUT_DIR, '__init__.py'), assembleInitFile(byModule), 'utf8');

  process.stdout.write(
    `[emit-pydantic] wrote ${totalSchemas} pydantic models across ${totalFiles} module files + __init__.py\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[emit-pydantic] FAILED: ${err.stack ?? err.message ?? err}\n`);
  process.exit(1);
});
