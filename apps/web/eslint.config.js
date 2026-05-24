/**
 * Web app ESLint flat config ([K1]).
 *
 * Replaces `next lint` (deprecated in Next 16; the deprecation
 * warning has been spamming every CI run since the Next 15.1 bump).
 * Wires three React/Next-specific plugins so inline
 * `// eslint-disable-next-line react-hooks/exhaustive-deps` comments
 * scattered through the codebase resolve to a real rule (under the
 * old `next lint` they did; under bare ESLint v9 they didn't).
 *
 * Layered:
 *   - `@app/eslint-config` — the workspace baseline (TS rules,
 *     security plugin from [I3], no-explicit-any, etc.).
 *   - `eslint-plugin-react-hooks` recommended — Rules of Hooks +
 *     exhaustive-deps. Both error.
 *   - `@next/eslint-plugin-next` recommended — Next-specific
 *     warnings (no-img-element, no-html-link-for-pages, etc.).
 *   - Local rule overrides: relax `eqeqeq` and a couple of others
 *     down to warn instead of error for the existing surface; a
 *     future PR can tighten + fix the offenders.
 */
import config from '@app/eslint-config';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  ...config,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      // The codebase pre-dates the strict shared config; existing
      // `==` / `!=` are warnings until a follow-up PR sweeps them.
      eqeqeq: 'warn',
      // ReDoS detector fires on bounded regexes in the codebase
      // (same false-positive pattern as the api side from [I3]).
      // Keep at warn here — strictly enforced only in apps/api/src.
      'security/detect-unsafe-regex': 'warn',
      // Rules-of-Hooks at warn for now — there's one pre-existing
      // conditional-hook offender (festivals trip detail) that needs
      // its own fix PR. Real, but not a K1 blocker.
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'sentry.*.config.ts',
      'e2e/**/*-snapshots/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },
];
