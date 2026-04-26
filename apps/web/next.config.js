/**
 * Next.js 15 config. Minimal — App Router defaults are fine.
 *
 * - `reactStrictMode`: catches lifecycle pitfalls early.
 * - `experimental.typedRoutes`: typed `<Link href>` helps prevent
 *   broken-link regressions across module renames.
 *
 * Installed by prompt [IV.18.19.14].
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Avoid Next pulling source maps from outside the apps/web/ tree —
  // monorepo siblings (apps/api/, packages/*) shouldn't end up in
  // the web bundle.
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
