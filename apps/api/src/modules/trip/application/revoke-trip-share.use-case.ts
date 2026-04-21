/**
 * Revoke a previously-minted share code. Owner-only, soft-delete
 * (flips `publicRead = false`). A subsequent `ResolveTripShareUseCase`
 * call on the same code returns `SHARE_NOT_FOUND` — same as a wholly
 * unknown code, so the revocation is indistinguishable from the
 * recipient's side.
 *
 * Missing code OR non-owner → 404 `SHARE_NOT_FOUND` (single code,
 * no existence-probe leak).
 *
 * Installed by prompt [IV.18.2.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

@Injectable()
export class RevokeTripShareUseCase {
  constructor(@Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository) {}

  async execute(shareCode: string, ownerId: string): Promise<void> {
    const revoked = await this.shares.revokeByCodeForOwner(shareCode, ownerId);
    if (!revoked) {
      throw new NotFoundError('Share not found', { shareCode }, 'SHARE_NOT_FOUND');
    }
  }
}
