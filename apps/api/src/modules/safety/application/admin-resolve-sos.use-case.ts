/**
 * Admin-driven SOS resolve. Lets ops mark another user's SOS
 * resolved (e.g. a support agent confirms the user is safe
 * out-of-band).
 *
 * 404 path: the SOS row doesn't exist OR is already resolved.
 * Both signals collapse to the same code so the response shape
 * stays stable for the dashboard.
 *
 * Installed by prompt [IV.18.18.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { SosEvent } from '../domain/sos-event.entity';
import { SOS_EVENT_REPOSITORY, type SosEventRepository } from './ports/sos-event.repository';

export interface AdminResolveSosCommand {
  readonly id: string;
  readonly note?: string;
}

@Injectable()
export class AdminResolveSosUseCase {
  constructor(@Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository) {}

  async execute(cmd: AdminResolveSosCommand): Promise<SosEvent> {
    const updated = await this.sos.adminResolve({
      id: cmd.id,
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
