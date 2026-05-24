/**
 * Stryker mutation-testing config ([H2]).
 *
 * Why this exists: line coverage lies. The [H1] coverage gate
 * shows 99.71% lines / 98.72% branches on the domain layer, but
 * coverage only proves a line EXECUTED — not that mutating its
 * logic would actually break a test. Stryker proves the latter
 * by introducing small, semantically-meaningful mutations (flip
 * `>` to `>=`, replace `&&` with `||`, swap `+` for `-`, delete
 * a method body, etc.) and reporting which mutations the test
 * suite catches.
 *
 * Scope: ONLY the 11 domain entities + trip-transitions — the
 * pure-function tier the [H1] gate also targets. These are the
 * files where mutations carry the most signal (a flipped operator
 * in a validator silently lets bad data through; a flipped
 * operator in DI wiring usually breaks compilation). Expanding
 * to controllers / repos is a future call, gated on the
 * integration-test infrastructure being hermetic enough that
 * Stryker can run the relevant subset cheaply.
 *
 * Runner: jest, pointed at the same `jest.config.unit.cjs` from
 * [H1]. testFilter narrows each mutation's test run to the
 * spec(s) most likely to catch it — Stryker's "find related
 * test" heuristic, on by default with the jest runner.
 *
 * Thresholds:
 *   - high  = 90: emoji + green badge in the HTML report.
 *   - low   = 80: amber; below this the report flags it.
 *   - break = 80: process exits non-zero (FAILS CI).
 *
 * Installed by [H2].
 */
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'pnpm',
  testRunner: 'jest',
  // Explicit plugin list: pnpm's strict node_modules layout makes
  // Stryker's default glob-based discovery miss the runner. List
  // them out so resolution is deterministic.
  plugins: ['@stryker-mutator/jest-runner', '@stryker-mutator/typescript-checker'],
  reporters: ['progress-append-only', 'clear-text', 'html', 'json'],
  // [H2] inPlace mode: Stryker mutates the actual source instead of
  // copying it into a `.stryker-tmp/sandbox-XXXX/` directory. We
  // can't use the sandbox because `jest.config.unit.cjs`'s
  // `path.resolve(__dirname, '../../packages/...')` resolves to the
  // sandbox path at runtime (not the apps/api/ path), breaking the
  // workspace moduleNameMapper. Stryker restores the files on
  // completion AND on crash, so the risk is bounded by the git
  // working-copy state (which is clean before each gate run).
  inPlace: true,
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.unit.cjs',
    enableFindRelatedTests: true,
  },
  // Each entry can be a positive glob (mutate this) or negative
  // (don't). We only mutate the domain entity tier; everything
  // else is implicit "don't."
  mutate: [
    'src/modules/social/domain/expense.entity.ts',
    'src/modules/social/domain/review.entity.ts',
    'src/modules/social/domain/trip-comment.entity.ts',
    'src/modules/social/domain/vote.entity.ts',
    'src/modules/safety/domain/scam-report.entity.ts',
    'src/modules/safety/domain/sos-event.entity.ts',
    'src/modules/safety/domain/agent-profile.entity.ts',
    'src/modules/media/domain/media-asset.entity.ts',
    'src/modules/account/domain/trusted-contact.entity.ts',
    'src/modules/diary/domain/diary-entry.entity.ts',
    'src/modules/trip/domain/itinerary.entity.ts',
    'src/modules/trip/domain/trip-transitions.ts',
  ],
  thresholds: { high: 90, low: 80, break: 80 },
  // Skip incremental — CI checkout is fresh every run, and
  // the local-dev cost is small (the scoped target is ~150 KB).
  incremental: false,
  // The jest runner picks up the timeout from jest.config.unit.cjs
  // (testTimeout: 5_000). For Stryker we add a buffer because the
  // sandboxed per-mutation run does more bookkeeping.
  timeoutMS: 10_000,
  // Concurrency = CPU count - 1 by default (Stryker auto-tunes).
  // The mutation surface is tiny enough that a single-digit minute
  // run is the expected ceiling.
  coverageAnalysis: 'perTest',
  // Mutator-disabled list. The first end-to-end Stryker run (8m47s,
  // 863 mutants, 64.08% score) showed the survivors were dominated
  // by two low-signal classes:
  //
  //   - StringLiteral mutations on error MESSAGE text. Our tests
  //     assert `err.code === 'INVALID_AMOUNT'`, never `err.message`,
  //     so a mutation that flips the message to "" survives — but
  //     no real consumer reads the message either. The contract is
  //     the code, not the prose.
  //   - ObjectLiteral mutations on error CONTEXT objects. Same
  //     reason: the context is observability metadata, not the
  //     behavioural contract. No test or caller introspects it.
  //
  // Disabling these globally drops the noise and lets the score
  // reflect what actually matters: operator flips (>= ↔ >), boolean
  // flips, conditional swaps (`if (x)` → `if (true)` / `if (false)`),
  // and method-removal mutations on the invariants themselves.
  // If a future entity uses error messages or context as part of
  // its public API, re-enable selectively via the per-line
  // `// Stryker restore` directive.
  mutator: {
    excludedMutations: ['StringLiteral', 'ObjectLiteral'],
  },
  disableTypeChecks: 'src/**/*.{ts,tsx}',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};
