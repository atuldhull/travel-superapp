/**
 * Extends @commitlint/config-conventional.
 *
 * Project convention: `<type>(<scope>): <subject>`
 *   e.g. chore(monorepo): scaffold workspace
 *        feat(config): build @app/config package
 *
 * `scope-case: [0]` is disabled so dotted + mixed-case scopes are allowed.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [0],
    'header-max-length': [2, 'always', 120],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
};
