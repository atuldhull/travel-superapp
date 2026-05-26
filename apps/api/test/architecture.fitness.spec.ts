/**
 * Architecture fitness functions — structural invariants the
 * `dependency-cruiser` rules (`.dependency-cruiser.cjs`) don't catch.
 *
 * dependency-cruiser enforces the EDGES of the clean/hex graph (which
 * layer may import which); this spec enforces the SHAPE of the graph
 * (every module is laid out the same way, every port is declared the
 * same way) and bans two specific decay patterns the lint config
 * doesn't have a rule for — bare `console.*` and `as any`.
 *
 * Together they make CLAUDE.md #9 + #10 mechanical: a violation is a
 * red CI build, not a code-review nit.
 *
 *   1. Module shape           — every `src/modules/<m>/` has a sibling
 *                              `<m>.module.ts` and the standard
 *                              clean-hex layer subdirs.
 *   2. Port declaration shape — every `application/ports/*.ts` exports
 *                              at least one `Symbol(...)` DI token AND
 *                              at least one `interface` / `type` —
 *                              i.e. a token paired with the contract
 *                              it tokenises.
 *   3. No `console.*`         — production code uses `@app/logger`
 *                              (CLAUDE.md #9), never the global
 *                              `console`.
 *   4. No `as any`            — CLAUDE.md #9 bans `any`; this catches
 *                              the cast that smuggles it back in.
 *   5. Zero non-module cycles — `madge --circular` over apps/api/src
 *                              excluding `<m>.module.ts` files. Catches
 *                              the payments-style ESM-fatal cycle that
 *                              dep-cruiser's `viaNot` rule also flags;
 *                              having TWO independent detectors removes
 *                              single-point-of-failure for the most
 *                              expensive failure mode we have on record
 *                              (a runtime crash on `tsx`).
 *
 * Installed by prompt [A6.1] — architecture road-to-10.
 * Madge cycle invariant added in [C3].
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
// `madge` ships no TS types (only an outdated `@types/madge@5` exists);
// declare the slice we use locally instead of depending on it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const madge = require('madge') as (
  path: string,
  config: { fileExtensions?: readonly string[]; excludeRegExp?: readonly RegExp[] },
) => Promise<{ circular: () => readonly (readonly string[])[] }>;

/** Walk a directory recursively, yielding every `*.ts` file path
 *  (POSIX-separator) relative to `root`. */
function* walkTs(root: string, current = root): Generator<string> {
  for (const entry of readdirSync(current)) {
    const abs = join(current, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      yield* walkTs(root, abs);
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      yield relative(root, abs).split('\\').join('/');
    }
  }
}

const API_SRC = join(__dirname, '..', 'src');
const MODULES_DIR = join(API_SRC, 'modules');

/** Modules that LEGITIMATELY skip a layer subdir — payments has no
 *  `domain/` because it's a thin Stripe DTO surface; everything else
 *  must have all four layer dirs. Keep this list TINY and DOCUMENTED;
 *  growing it is a smell. */
const LAYER_EXCEPTIONS: Record<string, ReadonlySet<string>> = {
  payments: new Set(['domain']),
};

describe('architecture fitness — module shape', () => {
  const modules = readdirSync(MODULES_DIR).filter((name) =>
    statSync(join(MODULES_DIR, name)).isDirectory(),
  );

  it('discovers at least one module (smoke)', () => {
    expect(modules.length).toBeGreaterThan(0);
  });

  it.each(modules)('module %s has a sibling <m>.module.ts composition root', (mod) => {
    const moduleFile = join(MODULES_DIR, mod, `${mod}.module.ts`);
    expect(() => statSync(moduleFile)).not.toThrow();
  });

  it.each(modules)('module %s has the standard clean-hex layer subdirs', (mod) => {
    const required = ['application', 'infrastructure', 'interface', 'domain'];
    const except = LAYER_EXCEPTIONS[mod] ?? new Set<string>();
    for (const layer of required) {
      if (except.has(layer)) continue;
      const layerDir = join(MODULES_DIR, mod, layer);
      const exists = (() => {
        try {
          return statSync(layerDir).isDirectory();
        } catch {
          return false;
        }
      })();
      expect({ module: mod, layer, exists }).toEqual({ module: mod, layer, exists: true });
    }
  });
});

describe('architecture fitness — port declarations', () => {
  // Every `application/ports/*.ts` is a port file. The convention is:
  //   - export const X_Y_Z = Symbol('XYZ');   // DI token
  //   - export interface XYZ { ... }          // (or `export type`)
  // Without the token, Nest can't inject it; without the type, callers
  // can't depend on a contract. A file with only one is half-built.
  const portFiles: string[] = [];
  for (const mod of readdirSync(MODULES_DIR)) {
    const portsDir = join(MODULES_DIR, mod, 'application', 'ports');
    try {
      if (!statSync(portsDir).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const entry of readdirSync(portsDir)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      portFiles.push(join(portsDir, entry));
    }
  }

  it('discovers port files (smoke)', () => {
    expect(portFiles.length).toBeGreaterThan(10);
  });

  it.each(portFiles)('%s exports both a Symbol DI token and a type/interface', (file) => {
    const source = readFileSync(file, 'utf8');
    // `export const FOO = Symbol(...)` — match a top-level Symbol-typed token.
    const hasSymbolToken = /export\s+const\s+[A-Z][A-Z0-9_]*\s*=\s*Symbol\s*\(/m.test(source);
    // Either `export interface Foo` or `export type Foo`.
    const hasContractType = /export\s+(interface|type)\s+[A-Z][A-Za-z0-9_]*/m.test(source);
    expect({ file: relative(API_SRC, file), hasSymbolToken, hasContractType }).toEqual({
      file: relative(API_SRC, file),
      hasSymbolToken: true,
      hasContractType: true,
    });
  });
});

describe('architecture fitness — banned patterns', () => {
  // Walk every src/**/*.ts once; flag forbidden patterns. Test files
  // (which legitimately use `console.*` in fixture seeders and `as
  // any` in mock-shaping) are not under src/, so this scope is right.
  const srcFiles = [...walkTs(API_SRC)];

  it('discovers source files (smoke)', () => {
    expect(srcFiles.length).toBeGreaterThan(100);
  });

  it('no `console.*` calls in src — use @app/logger (CLAUDE.md #9)', () => {
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // Match the global `console.<method>(` — qualified `this.console`
      // or `obj.console` is not the global and is filtered by the `\b`.
      if (/\bconsole\.(log|warn|error|info|debug|trace)\s*\(/m.test(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no `as any` casts in src — CLAUDE.md #9 bans `any`', () => {
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // `as any` with word-boundary on the right so `as anybody` etc. is fine.
      if (/\bas\s+any\b/m.test(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no module-level mutable Map/Set state — breaks horizontal scaling ([Q8])', () => {
    // Module-level `const FOO = new Map()` survives one process but
    // not two — the second machine sees an empty cache and either
    // re-fetches everything (low harm) or serves stale truth (real
    // harm). All mutable state lives in Postgres / Redis.
    //
    // Read-only lookup tables (`ReadonlyMap` / `ReadonlySet` type)
    // are fine — they're seed data, never mutated.
    //
    // Documented exceptions live in ALLOWED_STATEFUL_MODULES below.
    // Adding a site means making a conscious "this is OK because…"
    // decision; the fitness spec keeps the list honest.
    const ALLOWED_STATEFUL_MODULES = new Set<string>([
      // typed-redis-cache.ts maintains a static registry of every
      // cache instance for the metrics walker. The Set IS the
      // memory but the Set is also the only consumer; it never
      // syncs cross-process state (per-process metrics is the
      // intended shape — each machine reports its own counters).
      'common/cache/typed-redis-cache.ts',
    ]);

    const offenders: Array<{ file: string; line: string }> = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // Module-level (zero-indent) `const|let|var FOO ... = new
      // (Map|Set|WeakMap|WeakSet)(...)`. Reject unless the type
      // annotation is `ReadonlyMap` / `ReadonlySet`, OR the file is
      // explicitly allowlisted.
      const rels = rel.replace(/\\/g, '/');
      for (const line of source.split('\n')) {
        // Zero-indent statement.
        if (!/^(const|let|var)\s+\w+/.test(line)) continue;
        if (!/\bnew\s+(Map|Set|WeakMap|WeakSet)\s*[<(]/.test(line)) continue;
        // ReadonlyMap / ReadonlySet typed = OK (immutable seed data).
        if (/:\s*Readonly(Map|Set)\b/.test(line)) continue;
        if (ALLOWED_STATEFUL_MODULES.has(rels)) continue;
        offenders.push({ file: rel, line: line.trim() });
        break; // one finding per file is enough.
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no `redis.keys(` / `KEYS pattern` calls — KEYS blocks single-thread + bans cluster ([Q2])', () => {
    // KEYS is O(n) over the entire keyspace, blocks the Redis server,
    // and is rejected outright by cluster mode. Use SCAN (or
    // scanStream) instead. See docs/runbooks/redis-cluster-posture.md.
    //
    // We accept Lua's `KEYS[N]` array references — that's the CORRECT
    // way to pass keys into EVAL. The bad shape is `"KEYS pattern*"`
    // as a literal Redis command string (note the space after KEYS,
    // which separates Lua array refs from the dangerous command form).
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // .keys() on any identifier whose name contains redis / cache /
      // ioredis. Allows `Object.keys(` + `.keys()` on plain Map/Set.
      const redisKeysCall = /\b\w*(?:redis|cache|ioredis)\w*\s*\.\s*keys\s*\(/i;
      // Bare uppercase `KEYS<space>` inside a string literal — the
      // dangerous Redis command form. `KEYS[1]` (Lua array ref) is
      // not flagged because of the space requirement.
      const luaKeysCmd = /['"`]\s*KEYS\s+\S/;
      if (redisKeysCall.test(source) || luaKeysCmd.test(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('architecture fitness — external adapters wrapped in circuit breaker ([O1])', () => {
  // Every external call (fetch / SDK method to a paid or 3P service)
  // MUST go through `@app/resilience`'s `CircuitBreaker`. Without
  // this, a single upstream hiccup cascades into 5xx on our routes
  // (the canonical near-me-502-from-Open-Meteo example). Files that
  // call `fetch(` OR import an external SDK are checked against the
  // `@app/resilience` import + `CircuitBreaker|callExternal` token.
  const srcFiles = [...walkTs(API_SRC)];

  // Some files use `fetch(` for INTERNAL hops where a breaker would
  // be wrong (e.g. the health indicator IS the probe). Allowlist them
  // explicitly + keep this list TINY and DOCUMENTED.
  const ALLOWLIST = new Set<string>([
    // The health indicator IS the probe; wrapping it would defeat
    // its purpose (a broken upstream IS what we want to surface).
    'health/indicators/http-ping.indicator.ts',
  ]);

  const SDK_HINTS = [
    /from\s+['"]@anthropic-ai\/sdk/,
    /from\s+['"]@aws-sdk\/client-s3/,
    /from\s+['"]stripe['"]/,
    /from\s+['"]resend['"]/,
    /require\(['"]twilio['"]\)/,
    /import\s+.*from\s+['"]twilio['"]/,
  ];

  it('every external-call adapter imports @app/resilience', () => {
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      const norm = rel.replace(/\\/g, '/');
      if (ALLOWLIST.has(norm)) continue;
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // Three classes of external call: native fetch, an upstream SDK
      // import, OR `client.<method>` patterns we know wrap SDKs.
      const usesFetch = /\bawait\s+fetch\(|\bfetch\(['"`]/.test(source);
      const usesSdk = SDK_HINTS.some((re) => re.test(source));
      const isAdapter = /\/infrastructure\//.test(norm) || /\/common\/mailer\//.test(norm);
      if (!isAdapter) continue;
      if (!(usesFetch || usesSdk)) continue;
      if (/@app\/resilience/.test(source)) continue;
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});

describe('architecture fitness — shutdown hooks present ([M1])', () => {
  // L1 + L3 dropped --runInBand AND --forceExit by giving every
  // long-lived handle a real teardown. THESE invariants stop the
  // regression: a new file that holds a Redis socket / interval /
  // PrismaClient WITHOUT wiring its destroy hook would silently
  // require --forceExit again. Failing CI here forces the author
  // to add the teardown at the same commit.
  //
  // Three rules, one per resource family:
  //   1. `new Redis(`            → file MUST implement `OnModuleDestroy`
  //                                AND call `.quit()` somewhere.
  //   2. `setInterval(`          → file MUST also have a `clearInterval(`.
  //   3. Scheduler interface     → file MUST skip in NODE_ENV==='test'
  //                                so Jest doesn't have to chase a 24h
  //                                timer down on every spec.
  const srcFiles = [...walkTs(API_SRC)];

  it('every file owning an ioredis client implements OnModuleDestroy + .quit()', () => {
    const offenders: Array<{ file: string; reason: string }> = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      if (!/\bnew\s+Redis\s*\(/.test(source)) continue;
      if (!/\bOnModuleDestroy\b/.test(source)) {
        offenders.push({ file: rel, reason: 'no OnModuleDestroy' });
        continue;
      }
      if (!/\.quit\s*\(/.test(source)) {
        offenders.push({ file: rel, reason: 'no .quit() call' });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every setInterval owner also calls clearInterval (no orphan timers)', () => {
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      if (!/\bsetInterval\s*\(/.test(source)) continue;
      if (!/\bclearInterval\s*\(/.test(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every *.scheduler.ts skips itself when NODE_ENV==='test' (no 24h timer leaks)", () => {
    const offenders: string[] = [];
    for (const rel of srcFiles) {
      if (!rel.endsWith('.scheduler.ts')) continue;
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      // Either form is allowed: explicit `=== 'test'` or
      // `!== 'test'`-then-bail. We just need SOMETHING that gates
      // the timer on NODE_ENV.
      if (!/NODE_ENV.+['"]test['"]/.test(source)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('architecture fitness — file size (god-object proxy)', () => {
  // Pragmatic ceiling-based check, not a class-size analyzer. A
  // single .ts file growing past the per-tier limit below is a
  // strong signal that something is doing too much and should be
  // split — controller routes broken out, use-case logic pushed
  // into entities ([F4]), DTOs decomposed.
  //
  // Thresholds calibrated against the current tree (2026-05-24):
  //   - Worst overall: trip.controller.ts (1229) — sanctioned HTTP edge
  //   - Worst use-case: get-local-emergency.use-case.ts (702)
  //   - Worst DTO: trip-response.dto.ts (679)
  //
  // Limits give modest headroom over today's worst case so existing
  // code passes, but a NEW file blowing past these (e.g., a 2000-line
  // use-case) fails CI. Tightening the limits is a follow-up gated
  // on real refactors.
  const LIMITS = {
    controller: 1400, // *.controller.ts under interface/
    useCase: 800, // *.use-case.ts under application/
    dto: 800, // dto/ directory files
    domain: 500, // everything in domain/
    default: 700, // anything else under src/
  } as const;

  function limitFor(rel: string): number {
    if (rel.includes('/interface/dto/') || rel.endsWith('.dto.ts')) return LIMITS.dto;
    if (rel.endsWith('.controller.ts')) return LIMITS.controller;
    if (rel.endsWith('.use-case.ts')) return LIMITS.useCase;
    if (/\/domain\//.test(rel)) return LIMITS.domain;
    return LIMITS.default;
  }

  const srcFiles = [...walkTs(API_SRC)];

  it('every src .ts file is within its tier limit (no god objects)', () => {
    const offenders: Array<{ file: string; lines: number; limit: number }> = [];
    for (const rel of srcFiles) {
      const source = readFileSync(join(API_SRC, rel), 'utf8');
      const lines = source.split(/\r?\n/).length;
      const limit = limitFor(rel);
      if (lines > limit) {
        offenders.push({ file: rel, lines, limit });
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('architecture fitness — layer presence per module', () => {
  // Anemia smoke: a module without ANY domain file is the literal
  // "data-bag + use-case" anti-pattern the F4 work targets. We do NOT
  // gate on layer-size ratios — current ratios are all anemic by
  // best-practice standards (per-module domain/{rest-of-module} is
  // 1:25..1:50 across the codebase). That's exactly what F4 begins
  // to fix; gating on it now would block every PR. This invariant
  // catches only the LITERALLY anemic case: a module with zero
  // domain files.
  const modules = readdirSync(MODULES_DIR).filter((name) =>
    statSync(join(MODULES_DIR, name)).isDirectory(),
  );

  it.each(modules)('module %s has at least one domain .ts file (or is layer-exempted)', (mod) => {
    const except = LAYER_EXCEPTIONS[mod] ?? new Set<string>();
    if (except.has('domain')) return;
    const domainDir = join(MODULES_DIR, mod, 'domain');
    let count = 0;
    try {
      count = readdirSync(domainDir).filter(
        (n) => n.endsWith('.ts') && !n.endsWith('.d.ts'),
      ).length;
    } catch {
      count = 0;
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('architecture fitness — layer-size balance', () => {
  // [G3] A module dominated by one layer is structurally suspect:
  //   - >75% application = use-case sprawl that should be pushed into
  //     domain ([F4] is the active campaign).
  //   - >75% interface   = controller god; routes should delegate.
  //   - >75% infrastructure = persistence/adapter sprawl; missing port
  //     boundary.
  //   - >75% domain      = unusual (good kind of unusual) — would only
  //     trip if the whole rest of the module was empty stubs.
  //
  // 75% is a SOFT ceiling; worst current module is payments at 51.7%
  // (sanctioned no-domain-layer), then notifications at 50.5%. The
  // gate's job is to prevent a future regression where one layer
  // doubles while the others stay flat — that's the anemia signal.
  //
  // We DO NOT gate domain/{rest-of-module} ratio (CLAUDE.md targets a
  // hex-ideal high domain share, but every existing module is 1-10%
  // domain — gating that today would block every PR). The companion
  // "layer presence" check above already catches the literally-zero
  // case; the per-entity F4/G4 sweep is the real lever for raising
  // domain share over time.
  const LAYERS = ['domain', 'application', 'infrastructure', 'interface'] as const;
  const MAX_LAYER_SHARE = 0.75;

  function locOf(file: string): number {
    return readFileSync(file, 'utf8').split(/\r?\n/).length;
  }

  function walkAll(dir: string): string[] {
    const out: string[] = [];
    let entries: readonly string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const e of entries) {
      const abs = join(dir, e);
      const stat = statSync(abs);
      if (stat.isDirectory()) out.push(...walkAll(abs));
      else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) out.push(abs);
    }
    return out;
  }

  const modules = readdirSync(MODULES_DIR).filter((name) =>
    statSync(join(MODULES_DIR, name)).isDirectory(),
  );

  it.each(modules)('module %s: no single layer exceeds 75% of total module LOC', (mod) => {
    const byLayer: Record<string, number> = {};
    let total = 0;
    for (const layer of LAYERS) {
      const layerDir = join(MODULES_DIR, mod, layer);
      const sum = walkAll(layerDir).reduce((acc, f) => acc + locOf(f), 0);
      byLayer[layer] = sum;
      total += sum;
    }
    if (total === 0) return; // empty module — caught by other invariants
    const offenders: Array<{ layer: string; share: string }> = [];
    for (const layer of LAYERS) {
      const layerLoc = byLayer[layer] ?? 0;
      const share = layerLoc / total;
      if (share > MAX_LAYER_SHARE) {
        offenders.push({ layer, share: (share * 100).toFixed(1) + '%' });
      }
    }
    expect({ module: mod, offenders }).toEqual({ module: mod, offenders: [] });
  });
});

describe('architecture fitness — cycle detection (madge)', () => {
  // `madge --circular` is the OUTSIDE-LOOKING-IN cycle detector — it
  // walks the resolved TS/JS graph the same way Node would at run-
  // time, so it catches the same cycles esbuild / tsx would choke on.
  //
  // [G1]: we used to exclude `<m>.module.ts` wholesale (because Nest's
  // `forwardRef()` is sanctioned), but that hid NEW module-class
  // cycles. Posture is now an explicit allowlist: every forwardRef
  // cycle in the tree must appear in `ALLOWED_FORWARD_REF_CYCLES`
  // below (mirror copy in `apps/api/scripts/check-cycles.cjs`). A new
  // cycle = a deliberate decision logged here, not an invisible
  // default. A removed cycle = trim the allowlist in the same PR.
  //
  // Runtime: ~4-6s on the current api graph (660 files); cheaper
  // than the existing e2e suites, well within fitness-spec budget.

  /** Mirror of the script's allowlist. Each entry is a 2-cycle between
   *  two `*.module.ts` files; the trio of trip↔X cycles below ship
   *  with sanctioned `forwardRef(() => XModule)` calls. */
  const ALLOWED_FORWARD_REF_CYCLES: ReadonlyArray<readonly [string, string]> = [
    ['modules/food/food.module.ts', 'modules/trip/trip.module.ts'],
    ['modules/media/media.module.ts', 'modules/trip/trip.module.ts'],
    ['modules/safety/safety.module.ts', 'modules/trip/trip.module.ts'],
  ];

  /** Sort + join makes a stable key that works for any 2-cycle
   *  regardless of which direction madge reports it in. None of the
   *  sanctioned cycles are 3+ today; if one is ever added, switch to
   *  rotation-based normalisation. */
  function normalise(cycle: readonly string[]): string {
    return [...cycle].sort().join(' ⇄ ');
  }

  it('every cycle under apps/api/src is on the sanctioned forwardRef allowlist', async () => {
    const result = await madge(API_SRC, { fileExtensions: ['ts'] });
    const cycles = result.circular();

    const allowedKeys = new Set(ALLOWED_FORWARD_REF_CYCLES.map((c) => normalise(c)));
    const unsanctioned = cycles
      .filter((c: readonly string[]) => !allowedKeys.has(normalise(c)))
      .map((c: readonly string[]) => c.join(' -> '));
    expect(unsanctioned).toEqual([]);
  }, 30_000);

  it('every allowlisted forwardRef cycle is still present (no stale entries)', async () => {
    const result = await madge(API_SRC, { fileExtensions: ['ts'] });
    const present = new Set(result.circular().map((c: readonly string[]) => normalise(c)));
    const stale = ALLOWED_FORWARD_REF_CYCLES.map((c) => normalise(c)).filter(
      (k) => !present.has(k),
    );
    expect(stale).toEqual([]);
  }, 30_000);

  it('normalise() is direction-agnostic for 2-cycles (smoke)', () => {
    expect(normalise(['a.ts', 'b.ts'])).toBe(normalise(['b.ts', 'a.ts']));
  });

  it('an off-allowlist synthetic cycle would fail the gate (smoke)', () => {
    const fakeCycles = [
      ['modules/trip/trip.module.ts', 'modules/food/food.module.ts'], // allowed
      ['modules/payments/payments.module.ts', 'modules/auth/auth.module.ts'], // NOT allowed
    ];
    const allowedKeys = new Set(ALLOWED_FORWARD_REF_CYCLES.map((c) => normalise(c)));
    const unsanctioned = fakeCycles
      .filter((c) => !allowedKeys.has(normalise(c)))
      .map((c) => c.join(' -> '));
    expect(unsanctioned).toEqual([
      'modules/payments/payments.module.ts -> modules/auth/auth.module.ts',
    ]);
  });
});
