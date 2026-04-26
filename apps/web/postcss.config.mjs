/**
 * PostCSS pipeline. Tailwind 4's PostCSS plugin replaces the old
 * `tailwindcss` + `autoprefixer` two-step — `@tailwindcss/postcss`
 * does both. Kept the explicit `autoprefixer` dep around so we can
 * fall back if Tailwind 4's bundled prefix layer ever lags.
 *
 * Installed by [IV.18.19.18].
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
