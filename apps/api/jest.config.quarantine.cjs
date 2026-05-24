/**
 * Quarantine-only jest config ([L6]).
 *
 * Why this exists: when a test starts flaking we want to STOP it from
 * blocking PRs immediately, but we also want a visible record that
 * SOMETHING is broken — silent skips were the I-1/L-1 anti-pattern.
 * The quarantine path is the middle: move the file to `test/
 * quarantine/`, the main `tests` job no longer runs it, but this
 * config DOES — in a separate CI job whose failure is informational
 * (not PR-blocking) until the test is fixed and moved back.
 *
 * Conventions:
 *   - Adding to quarantine: `git mv test/foo.e2e-spec.ts
 *     test/quarantine/foo.e2e-spec.ts` + commit with a `chore(quarantine)`
 *     prefix that names the symptom + opens a tracking issue.
 *   - Coming out: move it back + assert the symptom is gone in the
 *     same PR.
 *
 * Installed by [L6].
 */
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/quarantine/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
};
