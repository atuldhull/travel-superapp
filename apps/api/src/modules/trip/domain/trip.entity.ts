/**
 * Plain-data domain `Trip`. Prisma's generated type omits `center`
 * (typed `Unsupported` in the schema) — we mirror that here so the
 * application layer doesn't try to read coordinates back from a row.
 * The client sent them in; nothing in the v1 flow needs to echo them.
 *
 * Installed by prompt [IV.18.2.3].
 */
export type TripStatus = 'draft' | 'published' | 'archived';

export interface Trip {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly status: TripStatus;
  readonly radiusKm: number;
  readonly startsOn: Date | null;
  readonly endsOn: Date | null;
  readonly version: number;
  /** V.UX.30 — non-null when soft-archived (auto-sweep after 365 days
   *  OR manual archive). Default lister filters these out. */
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
