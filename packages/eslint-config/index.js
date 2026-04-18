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
    },
  },
);
