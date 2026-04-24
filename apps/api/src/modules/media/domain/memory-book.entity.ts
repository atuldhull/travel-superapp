/**
 * Plain-data `MemoryBook` domain entity. A memory book bundles
 * a user's `MediaAsset` rows into a named album — "Paris 2026",
 * "Road trip west coast" — with a cover photo + theme.
 *
 * `publishedAt` v1 is dormant: the column exists but no HTTP
 * surface flips it. Publishing lives in a follow-up slice that
 * adds a public read surface with a share code — same shape as
 * TripShare.
 *
 * Installed by prompt [IV.18.12.6].
 */
export interface MemoryBook {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly coverS3Key: string | null;
  readonly theme: string;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A memory book plus its attached `MediaAsset` ids. v1 doesn't
 * return full MediaAsset rows (clients already have the
 * `GET /media/:id/download-url` endpoint — the book returns a
 * list of ids, client hydrates by id as needed). Keeps the book
 * response small + the ordering decision (creation-time vs
 * custom) deferred.
 */
export interface MemoryBookWithAssets {
  readonly book: MemoryBook;
  readonly assetIds: readonly string[];
}
