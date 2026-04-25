/**
 * Authenticated "give-me-my-data" use case. Wraps the cross-module
 * aggregator with the export envelope (`exportedAt` + `formatVersion`).
 *
 * 404 on missing `User` row — that's the only path here that isn't
 * a dumb pass-through. We don't try to rebuild a User the system
 * already destroyed; the future right-to-erasure flow
 * (`POST /account/delete`) is the natural follow-up surface.
 *
 * Installed by prompt [IV.18.16.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import type { UserDataExport } from '../domain/user-data-export.entity';
import { USER_DATA_AGGREGATOR, type UserDataAggregator } from './ports/user-data-aggregator';

@Injectable()
export class ExportUserDataUseCase {
  constructor(@Inject(USER_DATA_AGGREGATOR) private readonly agg: UserDataAggregator) {}

  async execute(userId: string): Promise<UserDataExport> {
    const bundle = await this.agg.aggregateForUser(userId);
    if (!bundle) throw new UserNotFoundError(userId);
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        formatVersion: 1,
        userId,
      },
      ...bundle,
    };
  }
}
