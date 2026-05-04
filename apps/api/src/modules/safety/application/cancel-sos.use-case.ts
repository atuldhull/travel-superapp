/**
 * V.UX.35 — owner-scoped "I'm OK" cancel of an active SOS.
 *
 * Reuses the same `SosEventRepository.resolve` write that the
 * `ResolveSosUseCase` (V.UX.13-era) uses, but stamps a stable
 * `cancelled` resolution note so the audit trail can distinguish a
 * user-initiated cancel from an admin / responder resolution.
 *
 * Single-use semantics come from the repo's `resolvedAt: null`
 * gate — re-cancelling an already-resolved event returns 404
 * `SOS_NOT_FOUND` (same response a stranger gets — IDOR-safe).
 *
 * Installed by prompt [V.UX.35].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { SosEvent } from '../domain/sos-event.entity';
import { SOS_EVENT_REPOSITORY, type SosEventRepository } from './ports/sos-event.repository';

export interface CancelSosCommand {
  readonly id: string;
  readonly userId: string;
}

export const CANCELLED_BY_USER_NOTE = 'cancelled_by_user';

@Injectable()
export class CancelSosUseCase {
  constructor(@Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository) {}

  async execute(cmd: CancelSosCommand): Promise<SosEvent> {
    const updated = await this.sos.resolve({
      id: cmd.id,
      userId: cmd.userId,
      note: CANCELLED_BY_USER_NOTE,
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
