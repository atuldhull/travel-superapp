/**
 * @app/config — Zod-validated environment for TravelSuperApp.
 *
 * Entry points:
 *   • `validateEnv(process.env)` — framework-agnostic; throws on failure.
 *   • `AppConfigModule.forRoot()` — NestJS global module.
 *   • `EnvSchema` / `Env` — the schema + inferred type (shared with tests
 *     and any TS caller that needs the shape).
 *
 * Playbook §11.1 / [III.11.1].
 */
export { EnvSchema } from './schema';
export type { Env } from './schema';
export { EnvValidationError, validateEnv } from './validate';
export type { EnvIssue } from './validate';
export { AppConfigModule } from './nest-config.module';
export type { AppConfigService } from './nest-config.module';
