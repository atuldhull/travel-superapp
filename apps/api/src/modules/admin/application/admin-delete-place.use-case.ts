/**
 * Admin delete-place use-case. Translates a `false` from
 * `PlaceRepository.deleteById` (= no row existed) into a
 * 404 `PLACE_NOT_FOUND`. Referential integrity with any trip
 * itinerary items that point at this place is enforced at the
 * DB level (FK cascade / restrict per Prisma schema); we do
 * not pre-check here.
 *
 * Installed by prompt [IV.18.3.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { PLACE_REPOSITORY, type PlaceRepository } from '../../places';

@Injectable()
export class AdminDeletePlaceUseCase {
  constructor(@Inject(PLACE_REPOSITORY) private readonly places: PlaceRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.places.deleteById(id);
    if (!deleted) {
      throw new NotFoundError(`Place not found: ${id}`, { placeId: id }, 'PLACE_NOT_FOUND');
    }
  }
}
