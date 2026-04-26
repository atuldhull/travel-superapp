/**
 * Next.js 15 config. Minimal — App Router defaults are fine.
 *
 * - `reactStrictMode`: catches lifecycle pitfalls early.
 * - `experimental.typedRoutes`: typed `<Link href>` helps prevent
 *   broken-link regressions across module renames.
 *
 * Installed by prompt [IV.18.19.14].
 */
const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Moved out of `experimental` in Next 15.5+; previous shape printed a
  // deprecation warning. Same behavior: typed `<Link href>` checking.
  typedRoutes: true,
  // `standalone` produces a self-contained .next/standalone/server.js
  // that bundles only the runtime files actually used. Required for
  // the apps/web/Dockerfile runner stage (no pnpm install at runtime).
  output: 'standalone',
  // Workspace siblings (`@app/sdk`) live outside apps/web — extend
  // file tracing up to the monorepo root so the standalone build
  // collects them. Defaults to the app dir, which omits them.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
};

module.exports = nextConfig;
