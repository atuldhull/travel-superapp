/**
 * Extends @commitlint/config-conventional.
 *
 * Project convention: `<type>(<prompt-id>): <subject>`
 *   e.g. chore(II.10.0): scaffold monorepo
 *        feat(III.11.1): build @app/config package
 *
 * The prompt-id (like "II.10.0" or "IV.19.1") maps to travel-app-prompts.md.
 * `scope-case: [0]` is disabled so Roman-numeral + dotted scopes are allowed.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [0],
    'header-max-length': [2, 'always', 120],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
};
