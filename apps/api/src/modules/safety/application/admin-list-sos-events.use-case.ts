/**
 * Admin SOS triage dashboard. Returns paginated SOS events
 * across all users (no `userId` scope) with optional status
 * filter (`active` | `resolved`).
 *
 * Default `limit` 50, cap 200 — same shape as every other
 * "list mod queue" surface.
 *
 * Installed by prompt [IV.18.18.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  SOS_EVENT_REPOSITORY,
  type AdminSosListResult,
  type AdminSosListStatus,
  type SosEventRepository,
} from './ports/sos-event.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface AdminListSosEventsCommand {
  readonly status?: AdminSosListStatus;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AdminListSosEventsUseCase {
  constructor(@Inject(SOS_EVENT_REPOSITORY) private readonly sos: SosEventRepository) {}

  async execute(cmd: AdminListSosEventsCommand): Promise<AdminSosListResult> {
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const offset = cmd.offset === undefined ? 0 : Math.max(0, Math.floor(cmd.offset));
    return this.sos.adminList({
      ...(cmd.status !== undefined ? { status: cmd.status } : {}),
      limit,
      offset,
    });
  }
}
