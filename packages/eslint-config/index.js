/**
 * Shared flat ESLint config for TravelSuperApp.
 *
 * Consumer usage (per package or per app):
 *   import config from '@app/eslint-config';
 *   export default config;
 *
 * Enforces:
 *   - @typescript-eslint/recommended
 *   - no `any`
 *   - no `console.log` (use @app/logger) — warn + error allowed
 *   - unused vars error except `_`-prefixed
 *
 * Bounded-context enforcement (domain ← application ← infrastructure/interface)
 * will be layered in a later prompt via `import/no-restricted-paths`.
 */
import tseslint from 'typescript-eslint';
import globals from 'globals';
import securityPlugin from 'eslint-plugin-security';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/build/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
    ],
  },
  ...tseslint.configs.recommended,
  // [I3] eslint-plugin-security — catches well-known JS/TS smells at
  // PR-author time, complementing the Semgrep CI gate (which catches
  // the same patterns again as a backstop, plus the OWASP rule set
  // semgrep ships). Most rules are `warn` by default in this plugin;
  // we promote the high-confidence ones to `error` and leave the
  // noisier ones (e.g. detect-non-literal-fs-filename — fires on
  // every legitimate `fs.readFile(path)` call) at `warn`.
  securityPlugin.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      // [I3] elevate high-confidence security rules from warn → error.
      // `eval`, unsafe RegExp, `new Buffer()`, child-process eval —
      // these have zero legitimate uses in this codebase.
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
    },
  },
);
