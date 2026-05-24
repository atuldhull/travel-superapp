/**
 * Contract snapshot for the API's OpenAPI surface ([I4]).
 *
 * `docs/api/openapi.yaml` is auto-generated from the Nest decorators
 * by `pnpm api:openapi` ([D1] sdk:check gates that the generated YAML
 * matches the live controller surface). What sdk:check DOES NOT
 * catch: an intentional change to the contract slips through because
 * the SDK is regenerated in the same PR — the reviewer never gets a
 * separate signal that "the public API shape moved."
 *
 * This snapshot adds that signal. We extract the FLAT contract — a
 * sorted list of `<method> <path> → <response codes>` strings —
 * and Jest-snapshot it. Any change to the public surface (new
 * endpoint, renamed path, removed response code, etc.) fails this
 * test until the reviewer runs `pnpm test -u` to accept the new
 * baseline. The diff is then part of the PR review.
 *
 * We DELIBERATELY do not snapshot the schemas themselves — those
 * change too often (every Zod tweak) and would generate review
 * fatigue. The endpoint surface is the stable contract.
 *
 * Installed by prompt [I4].
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const OPENAPI_PATH = join(__dirname, '..', '..', '..', 'docs', 'api', 'openapi.yaml');

interface OpenApiOperation {
  readonly operationId?: string;
  readonly responses?: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
}

interface OpenApiPath {
  readonly [method: string]: OpenApiOperation | undefined;
}

interface OpenApiDoc {
  readonly openapi: string;
  readonly paths: Readonly<Record<string, OpenApiPath>>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function loadDoc(): OpenApiDoc {
  const yaml = readFileSync(OPENAPI_PATH, 'utf8');
  return parseYaml(yaml) as OpenApiDoc;
}

describe('contract — OpenAPI surface snapshot', () => {
  it('public endpoint contract is stable (snapshot)', () => {
    const doc = loadDoc();
    const rows: string[] = [];
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const method of METHODS) {
        const op = ops[method];
        if (!op) continue;
        const codes = Object.keys(op.responses ?? {})
          .sort()
          .join(',');
        const operationId = op.operationId ?? '(no operationId)';
        rows.push(
          `${method.toUpperCase().padEnd(6)} ${path.padEnd(60)} → ${codes.padEnd(20)} :: ${operationId}`,
        );
      }
    }
    rows.sort();
    // The snapshot lives under apps/api/test/__snapshots__/contract.openapi-snapshot.spec.ts.snap.
    // Update via `pnpm --filter=api jest -u test/contract.openapi-snapshot.spec.ts`.
    expect(rows.join('\n')).toMatchSnapshot();
  });

  it('openapi version is pinned to 3.0.0 (catches accidental bumps)', () => {
    expect(loadDoc().openapi).toBe('3.0.0');
  });

  it('every operation has an operationId (SDK codegen prereq)', () => {
    const doc = loadDoc();
    const missing: string[] = [];
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const method of METHODS) {
        const op = ops[method];
        if (op && !op.operationId) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
