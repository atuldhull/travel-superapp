/**
 * POST.2B.2 — publish a trip (owner-gated, privacy-fenced).
 *
 * Enforces INVARIANT A (trip must have ended) via the domain
 * `assertPublishable`, then computes the exposed location via the
 * domain `exposeGeo` (INVARIANT B) before persisting. Default
 * visibility = FOLLOWERS (decision D2 — PUBLIC needs an explicit
 * choice + a 2nd confirm at the UI layer).
 *
 * Trip center is read via GeoQueries (CLAUDE.md #11 — never touch
 * `Trip.center` directly).
 *
 * Installed by prompt [POST.2B.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { createLogger, type AppLogger } from '@app/logger';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip';
import type { Trip } from '../../trip/domain/trip.entity';
import {
  assertPublishable,
  exposeGeo,
  type TripPublication,
  type Visibility,
} from '../domain/trip-publication.entity';
import {
  TRIP_PUBLICATION_REPOSITORY,
  type TripPublicationRepository,
} from './ports/trip-publication.repository';
import { EMBEDDING_PORT, type EmbeddingPort } from './ports/embedding.port';

export interface PublishTripCommand {
  readonly tripId: string;
  readonly userId: string;
  /** Defaults to FOLLOWERS (D2). */
  readonly visibility?: Visibility;
  /** Only meaningful for FOLLOWERS — keep precise geo. */
  readonly preciseGeoOptIn?: boolean;
}

@Injectable()
export class PublishTripUseCase {
  private readonly logger: AppLogger = createLogger('publish-trip');

  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(TRIP_PUBLICATION_REPOSITORY)
    private readonly pubs: TripPublicationRepository,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async execute(cmd: PublishTripCommand): Promise<TripPublication> {
    // Owner-gate: only the trip owner can publish it.
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!trip) {
      throw new NotFoundError('Trip not found', { tripId: cmd.tripId }, 'TRIP_NOT_FOUND');
    }

    // INVARIANT A — must have definitively ended.
    assertPublishable(trip.endsOn, new Date());

    const visibility: Visibility = cmd.visibility ?? 'FOLLOWERS';
    const center = await this.geo.findTripCenter(cmd.tripId);

    // INVARIANT B — coarsen exposed location per visibility.
    const exposed = exposeGeo(
      center?.lat ?? null,
      center?.lng ?? null,
      visibility,
      cmd.preciseGeoOptIn ?? false,
    );

    const pub = await this.pubs.upsertPublish({
      tripId: cmd.tripId,
      authorId: cmd.userId,
      memoryBookId: null,
      visibility,
      exposedLat: exposed.lat,
      exposedLng: exposed.lng,
      publishedAt: new Date(),
    });

    // POST.2C.2 — embed-on-publish, BEST-EFFORT. An absent/failed
    // Ollama must NEVER fail the publish (mirrors the 1.0 Sharp
    // variant pipeline): the publication row is already committed
    // above; indexing is a follow-on side effect.
    await this.indexBestEffort(pub, trip, visibility, exposed);
    return pub;
  }

  /**
   * Compose a privacy-safe embedding text and write the vector. Only
   * the visibility-COARSENED exposed coords are embedded — never the
   * precise trip center (LAW 2: no precise geo leaves the safety
   * fence, not even into the local index). Any failure here is
   * swallowed; the dimension guard in the repo still prevents a
   * malformed vector from ever reaching pgvector.
   */
  private async indexBestEffort(
    pub: TripPublication,
    trip: Trip,
    visibility: Visibility,
    exposed: { lat: number | null; lng: number | null },
  ): Promise<void> {
    try {
      const vec = await this.embeddings.embed(this.buildEmbeddingText(trip, visibility, exposed));
      await this.pubs.setEmbedding(pub.tripId, pub.authorId, vec);
    } catch (err) {
      // Loud in observability (a dimension mismatch is a hard bug)
      // but the user's publish still succeeds — by design.
      this.logger.error(
        { tripId: pub.tripId, err: err instanceof Error ? err.message : String(err) },
        'trip_embedding_index_failed_best_effort',
      );
    }
  }

  private buildEmbeddingText(
    trip: Trip,
    visibility: Visibility,
    exposed: { lat: number | null; lng: number | null },
  ): string {
    const parts = [`${trip.title}.`, `A trip within ~${trip.radiusKm}km`];
    if (exposed.lat !== null && exposed.lng !== null) {
      // Coarsened (≤1dp ≈ city level) — see exposeGeo / INVARIANT B.
      parts.push(`near approx ${exposed.lat.toFixed(1)},${exposed.lng.toFixed(1)}`);
    }
    if (trip.startsOn && trip.endsOn) {
      parts.push(
        `from ${trip.startsOn.toISOString().slice(0, 10)} to ${trip.endsOn
          .toISOString()
          .slice(0, 10)}`,
      );
    }
    parts.push(`(${visibility.toLowerCase()})`);
    return parts.join(' ');
  }
}
