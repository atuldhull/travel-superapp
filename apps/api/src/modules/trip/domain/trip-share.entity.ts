/**
 * Plain-data domain `TripShare`. Represents an opaque share code
 * that grants read-only access to a single trip. Expiry is optional
 * — `expiresAt: null` means the share never auto-expires; the owner
 * still needs a future revoke-endpoint to kill it early.
 *
 * Installed by prompt [IV.18.2.13].
 */
export interface TripShare {
  readonly id: string;
  readonly tripId: string;
  readonly ownerId: string;
  readonly shareCode: string;
  readonly publicRead: boolean;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}
