/**
 * @app/sdk eslint flat config. Re-exports the shared monorepo config
 * with one local relaxation: the entire `src/generated/**` tree is
 * orval-produced ([D1] sdk:check gate) and intentionally not
 * hand-edited, so lint rules on it are noise (catch any drift
 * separately via that gate, not eslint).
 *
 * The package was previously relying on ESLint's parent-config
 * lookup, which stopped working in v9 (flat config dropped that).
 * Surfaced as part of [I3] when the full `pnpm lint` sweep ran
 * across every workspace.
 */
import config from '@app/eslint-config';

export default [
  ...config,
  {
    ignores: ['src/generated/**', 'dist/**'],
  },
];
