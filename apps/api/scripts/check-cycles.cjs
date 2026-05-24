#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
/**
 * Strict cycle gate ([G1]) — replaces the prior
 *   `madge --circular --extensions ts --exclude "\\.module\\.ts$" src`
 * which hid module-class cycles wholesale. The previous posture treated
 * EVERY `<m>.module.ts ↔ <n>.module.ts` cycle as sanctioned (Nest
 * `forwardRef()` is the recommended pattern), but the exclusion meant a
 * NEW module cycle landed silently. That is a real regression: every
 * forwardRef cycle is a load-order hazard and should be a deliberate
 * decision logged here, not an invisible default.
 *
 * This script:
 *   1. Runs madge over apps/api/src with NO exclusions.
 *   2. Normalises each cycle by sorting + joining (works for any
 *      2-cycle, which is all the forwardRef cycles in our tree).
 *   3. Subtracts the explicit `ALLOWED_FORWARD_REF_CYCLES` allowlist
 *      below — these are the three trip↔X module-class cycles that
 *      ship with sanctioned `forwardRef(() => XModule)` calls.
 *   4. Exits 0 if the remainder is empty; 1 otherwise, listing offenders.
 *
 * Mirror copy of the allowlist lives in
 *   apps/api/test/architecture.fitness.spec.ts (`ALLOWED_FORWARD_REF_CYCLES`)
 * — keep the two in sync. (Three-entry list; duplication is cheaper
 * than a cross-tool shared module require dance.)
 *
 * Installed by prompt [G1].
 */
const path = require('node:path');
const madge = require('madge');

/**
 * Each entry is a 2-cycle between two module-class files, normalised as
 * `[A, B]` sorted lexicographically. If a 3+ cycle is ever sanctioned,
 * extend `normalise()` below to handle rotation.
 *
 * Why each cycle exists:
 *   - trip ↔ food   : ItineraryItem ↔ Place enrichment (Trip needs
 *                     Place lookup for itinerary build; Food needs Trip
 *                     context for "added to trip?" badges).
 *   - trip ↔ media  : Trip media (cover photo, gallery) lives in
 *                     MediaModule but Trip routes return media URLs.
 *   - trip ↔ safety : Local-emergency + scam-report enrichment for
 *                     itinerary stops; Safety reads TripShare for
 *                     collaborator-only ScamReports.
 */
const ALLOWED_FORWARD_REF_CYCLES = [
  ['modules/food/food.module.ts', 'modules/trip/trip.module.ts'],
  ['modules/media/media.module.ts', 'modules/trip/trip.module.ts'],
  ['modules/safety/safety.module.ts', 'modules/trip/trip.module.ts'],
];

/** Normalise a cycle (array of POSIX-relative paths) into a stable
 *  string key by sorting + joining. Works for any 2-cycle; for 3+ we'd
 *  need rotation. None exist today. */
function normalise(cycle) {
  return [...cycle].sort().join(' ⇄ ');
}

const ALLOWED_SET = new Set(ALLOWED_FORWARD_REF_CYCLES.map(normalise));

async function main() {
  const SRC = path.resolve(__dirname, '..', 'src');
  const result = await madge(SRC, { fileExtensions: ['ts'] });
  const cycles = result.circular();

  const unsanctioned = cycles.filter((c) => !ALLOWED_SET.has(normalise(c)));
  const sanctionedHits = cycles.filter((c) => ALLOWED_SET.has(normalise(c)));

  // Surface a clean summary so CI logs read at a glance.
  if (sanctionedHits.length > 0) {
    process.stdout.write(`✔ ${sanctionedHits.length} sanctioned forwardRef cycle(s):\n`);
    for (const c of sanctionedHits) process.stdout.write(`    ${normalise(c)}\n`);
  }

  if (unsanctioned.length > 0) {
    process.stderr.write(`\n✖ ${unsanctioned.length} UNSANCTIONED cycle(s):\n`);
    for (const c of unsanctioned) process.stderr.write(`    ${c.join(' -> ')}\n`);
    process.stderr.write(
      '\nFix the cycle, or — if it is a deliberate `forwardRef()` — add it to\n' +
        '  ALLOWED_FORWARD_REF_CYCLES in apps/api/scripts/check-cycles.cjs\n' +
        '  AND in apps/api/test/architecture.fitness.spec.ts\n',
    );
    process.exit(1);
  }

  // Also enforce that every allowlisted cycle is STILL PRESENT — if
  // someone removes the forwardRef and the cycle goes away, we want
  // the allowlist trimmed in the same PR, not left to bit-rot.
  const presentKeys = new Set(cycles.map(normalise));
  const stale = [...ALLOWED_SET].filter((k) => !presentKeys.has(k));
  if (stale.length > 0) {
    process.stderr.write(`\n✖ ${stale.length} stale allowlist entry(ies):\n`);
    for (const k of stale) process.stderr.write(`    ${k}\n`);
    process.stderr.write(
      '\nThese cycles no longer exist. Remove them from ALLOWED_FORWARD_REF_CYCLES\n' +
        '  in apps/api/scripts/check-cycles.cjs AND\n' +
        '  in apps/api/test/architecture.fitness.spec.ts\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n✓ zero unsanctioned cycles (${sanctionedHits.length} sanctioned, allowlist current)\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`check-cycles failed: ${err.stack ?? err.message ?? err}\n`);
  process.exit(1);
});
