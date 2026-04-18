/**
 * NestJS ConfigModule factory backed by our Zod-validated `Env` schema.
 *
 * Usage in apps/api:
 *   // main.ts — instrumentation first, then imports
 *   import { AppConfigModule } from '@app/config';
 *   @Module({ imports: [AppConfigModule.forRoot()] })
 *   export class AppModule {}
 *
 *   // anywhere
 *   constructor(private readonly config: AppConfigService) {}
 *   const dbUrl = this.config.get('DATABASE_URL', { infer: true });
 *
 * The underlying `@nestjs/config` ConfigService is re-typed as
 * `AppConfigService` so calls to `get()` return the typed Env value.
 *
 * Playbook §11.1 / [III.11.1].
 */
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from './schema';
import { validateEnv } from './validate';

/**
 * Typed ConfigService. Use this instead of the raw `ConfigService` so
 * `get(key)` is keyed on `Env` and the return type is inferred.
 */
export type AppConfigService = ConfigService<Env, true>;

@Module({})
export class AppConfigModule {
  /**
   * Register the global config module. Validates `process.env` at startup
   * and aborts (via thrown EnvValidationError) on any invalid variable.
   */
  static forRoot(): DynamicModule {
    return {
      module: AppConfigModule,
      global: true,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          // `validate` receives the raw env map; we return a typed object
          // so @nestjs/config then serves values from the validated copy.
          validate: (raw: Record<string, unknown>) => validateEnv(raw),
        }),
      ],
      exports: [ConfigModule],
    };
  }
}
