/**
 * Write-through from federated provider results into the canonical
 * `Place` catalog. The federated layer is read-only; this use-case
 * is the explicit verb that turns ephemeral provider hits into
 * persistent rows.
 *
 * Dedup anchor: `sourceKey = sha256(provider + ':' + externalId)`
 * (matches the schema's `@unique` constraint comment). A repeated
 * call with the same federated result returns the existing row,
 * so the operation is naturally idempotent — clients can call it
 * any time without worrying about duplicates.
 *
 * Race policy: a concurrent insert from another request may win
 * the unique-constraint contention. We catch the Prisma `P2002`
 * (unique violation), re-read by `sourceKey`, and return that row.
 * Without this guard, a high-fanout client could see sporadic
 * 500s on otherwise-correct ingest calls.
 *
 * Returns one `IngestedPlace` per input result, preserving order
 * + carrying the input distance so callers don't have to
 * re-correlate by `externalId`.
 *
 * Installed by prompt [IV.18.4.2].
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createLogger } from '@app/logger';
import type { FederatedPlaceResult } from '../domain/federated-place-result.entity';
import type { Place } from '../domain/place.entity';
import { PLACE_REPOSITORY, type PlaceRepository } from './ports/place.repository';

const log = createLogger('places.ingest');

export interface IngestedPlace {
  readonly place: Place;
  readonly distanceMeters: number;
  readonly created: boolean;
}

@Injectable()
export class IngestFederatedResultsUseCase {
  constructor(@Inject(PLACE_REPOSITORY) private readonly repo: PlaceRepository) {}

  async execute(results: readonly FederatedPlaceResult[]): Promise<readonly IngestedPlace[]> {
    const out: IngestedPlace[] = [];
    for (const r of results) {
      const sourceKey = sourceKeyFor(r.provider, r.externalId);

      const existing = await this.repo.findBySourceKey(sourceKey);
      if (existing) {
        out.push({ place: existing, distanceMeters: r.distanceMeters, created: false });
        continue;
      }

      try {
        const inserted = await this.repo.insert({
          sourceKey,
          name: r.name,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          address: r.address,
          countryCode: r.countryCode,
          metadata: { provider: r.provider, externalId: r.externalId },
        });
        out.push({ place: inserted, distanceMeters: r.distanceMeters, created: true });
      } catch (err) {
        // Concurrent insert raced us. Re-read by sourceKey and use
        // whichever side won.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const winner = await this.repo.findBySourceKey(sourceKey);
          if (winner) {
            out.push({ place: winner, distanceMeters: r.distanceMeters, created: false });
            continue;
          }
        }
        log.warn(
          {
            err: err instanceof Error ? err.message : String(err),
            sourceKey,
            provider: r.provider,
            externalId: r.externalId,
          },
          'place_ingest_failed',
        );
        throw err;
      }
    }
    return out;
  }
}

/**
 * `sha256(provider + ':' + externalId)` — hex-encoded. Stable
 * across provider id format changes (so future Google migration
 * from `<placeId>` to `places/<placeId>` would NOT shift our
 * keys; only the input to the hash matters). Matches the schema
 * comment on `Place.sourceKey`.
 */
export function sourceKeyFor(provider: string, externalId: string): string {
  return createHash('sha256').update(`${provider}:${externalId}`).digest('hex');
}
