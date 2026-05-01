/**
 * Metro config for the Expo 51 monorepo. Two adjustments vs the
 * bare `expo/metro-config`:
 *
 *   1. `watchFolders` — climb up to the workspace root so changes to
 *      `packages/sdk` reload the app.
 *   2. `nodeModulesPaths` — Metro resolves shared deps (react,
 *      react-native, @tanstack/*) from the monorepo root pnpm store.
 *
 * Same shape as the standard Expo + pnpm monorepo recipe.
 *
 * Installed by prompt [V.UX.27].
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
