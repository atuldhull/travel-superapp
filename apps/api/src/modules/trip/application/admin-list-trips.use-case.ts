/**
 * Admin trip moderation list. Cross-user (no userId scope) with
 * optional filters: `q` (case-insensitive substring on title)
 * and `status` (draft | published | archived). Default limit 50,
 * cap 200 — same shape as every other admin list surface.
 *
 * Most-recent-first. Returns `{ rows, total }` so the UI can
 * render "Showing N of M".
 *
 * Installed by prompt [IV.18.18.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripStatus } from '../domain/trip.entity';
import {
  TRIP_REPOSITORY,
  type AdminTripListResult,
  type TripRepository,
} from './ports/trip.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface AdminListTripsCommand {
  readonly q?: string;
  readonly status?: TripStatus;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class AdminListTripsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(cmd: AdminListTripsCommand): Promise<AdminTripListResult> {
    const limit =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    const offset = cmd.offset === undefined ? 0 : Math.max(0, Math.floor(cmd.offset));
    return this.trips.adminList({
      ...(cmd.q !== undefined ? { q: cmd.q } : {}),
      ...(cmd.status !== undefined ? { status: cmd.status } : {}),
      limit,
      offset,
    });
  }
}
