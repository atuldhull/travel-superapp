/**
 * List the caller's own SOS events, most-recent-first. Used by a
 * "my safety history" UI and by ops for audit. Includes both
 * active (unresolved) and resolved events; filter on `resolvedAt`
 * is a client concern.
 *
 * Installed by prompt [IV.18.11.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { SosEvent } from '../domain/sos-event.entity';
import { SOS_EVENT_REPOSITORY, type SosEventRepository } from './ports/sos-event.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListMySosEventsUseCase {
  constructor(@Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository) {}

  async execute(userId: string, limit?: number): Promise<readonly SosEvent[]> {
    const clamped =
      limit === undefined ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
    return this.sos.listForUser(userId, clamped);
  }
}
