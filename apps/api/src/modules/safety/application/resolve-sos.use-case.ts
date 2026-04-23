/**
 * Mark one of the caller's own SOS events as resolved. Idempotency-
 * breaking on purpose: a second resolve on the same event returns
 * 404 `SOS_NOT_FOUND` (same response a stranger would get) because
 * the repo's WHERE clause requires `resolvedAt: null`. Matches the
 * trip-share revoke pattern.
 *
 * `note` is optional — callers describe "false alarm" or "false
 * alarm, was meeting friends" or similar. Free text; no length cap
 * at the use-case (Zod DTO caps at 500 at the HTTP edge).
 *
 * Installed by prompt [IV.18.11.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { SosEvent } from '../domain/sos-event.entity';
import { SOS_EVENT_REPOSITORY, type SosEventRepository } from './ports/sos-event.repository';

export interface ResolveSosCommand {
  readonly id: string;
  readonly userId: string;
  readonly note?: string;
}

@Injectable()
export class ResolveSosUseCase {
  constructor(@Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository) {}

  async execute(cmd: ResolveSosCommand): Promise<SosEvent> {
    const updated = await this.sos.resolve({
      id: cmd.id,
      userId: cmd.userId,
      note: cmd.note ?? null,
    });
    if (!updated) {
      throw new NotFoundError(
        `SOS event not found or already resolved: ${cmd.id}`,
        { sosEventId: cmd.id },
        'SOS_NOT_FOUND',
      );
    }
    return updated;
  }
}
