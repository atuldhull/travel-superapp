/**
 * POST.2C.1 — Seam 1 inbound port: the agent asks media to draft a
 * Memory Book from a finished trip. Hex direction: agent → media
 * (media NEVER depends on agent). The drafted book is a PRIVATE
 * draft (publishedAt = null — the codebase's existing "not yet
 * published" semantic). This port deliberately exposes NO publish
 * capability.
 *
 * Installed by prompt [POST.2C.1].
 */
export interface DraftBookFromTripInput {
  readonly tripId: string;
  readonly ownerId: string;
  readonly title: string;
}

export interface DraftBookFromTripResult {
  readonly memoryBookId: string;
}

export interface TripBookDrafter {
  draftFromTrip(input: DraftBookFromTripInput): Promise<DraftBookFromTripResult>;
}

export const TRIP_BOOK_DRAFTER_PORT = Symbol('TripBookDrafter');
