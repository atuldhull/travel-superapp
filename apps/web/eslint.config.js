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
      // `==`/`!=` warn — except comparing to null. `x == null` (matches
      // null OR undefined together) is the one idiomatic loose-equality
      // use, allowed via { null: 'ignore' }.
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      // ReDoS detector fires on bounded regexes in the codebase
      // (same false-positive pattern as the api side from [I3]).
      // Keep at warn here — strictly enforced only in apps/api/src.
      'security/detect-unsafe-regex': 'warn',
      // Rules-of-Hooks stays an error so conditional-hook bugs are caught.
      'react-hooks/rules-of-hooks': 'error',
      // ── eslint-plugin-security: advisory heuristics that are ~100%
      // false-positive in this front-end and were never enforced (warn
      // only). They fire on every `obj[key]` / `arr[i]` read, on plain
      // `=== null` / `!boolean` comparisons (e.g. `if (!bootComplete)` is
      // not a "timing attack"), and on legitimate server reads of
      // app-bundled files. Turned off so they don't bury real signal; the
      // high-confidence security rules (eval, child_process, new Buffer,
      // pseudoRandomBytes, unsafe-regex) stay errors in @app/eslint-config,
      // and Semgrep CI is the backstop.
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      // Several surfaces intentionally use a raw <img> for external /
      // dynamic URLs (Unsplash, S3 media) that next/image can't optimise
      // without a domain allow-list; this is a perf advisory, not a bug.
      '@next/next/no-img-element': 'off',
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
