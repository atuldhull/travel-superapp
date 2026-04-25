/**
 * GDPR / DPDP / COPPA "give-me-my-data" envelope. The shape is a
 * flat record of named sections, each `{ count, rows[] }`. A
 * future format-bump (e.g. wire-protocol change, additional
 * sections) MUST increment `metadata.formatVersion` so downstream
 * tooling that snapshots a user's bundle can detect a schema
 * shift without diffing the rows.
 *
 * Privacy invariants enforced by the port adapter (NOT here):
 *
 *   - Never include `User.passwordHash` / `mfaSecret` /
 *     `emailEncrypted` (the latter is reversible only with the
 *     pgcrypto key — not appropriate to ship in a self-export).
 *   - Never include MFA backup-code plaintext (we don't store it).
 *   - PostGIS columns omitted from v1 — `Trip.center`, `MediaAsset.coordinates`,
 *     `ScamReport.coordinates`, `SosEvent.coordinates`. Bringing them
 *     back as `{ lng, lat }` requires `GeoQueries` raw-SQL extraction
 *     (CLAUDE.md rule 11) and is queued for v2.
 *
 * Installed by prompt [IV.18.16.1].
 */

export interface UserDataExportSection<T> {
  readonly count: number;
  readonly rows: readonly T[];
}

export interface UserDataExportMetadata {
  readonly exportedAt: string; // ISO-8601
  readonly formatVersion: 1;
  readonly userId: string;
}

/**
 * Per-section row shapes. Each is a strict subset of the underlying
 * Prisma row — sensitive fields stripped at the adapter boundary.
 * `unknown` is avoided: every field is typed so downstream tooling
 * (test snapshots, future parsers) compiles against this shape.
 */
export interface ExportedUser {
  readonly id: string;
  readonly emailHash: string;
  readonly role: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly locale: string;
  readonly timezone: string;
  readonly mfaEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface ExportedPreferences {
  readonly diet: readonly string[];
  readonly accessibility: readonly string[];
  readonly travelType: readonly string[];
  readonly budgetTier: number;
  readonly dnd: Readonly<Record<string, unknown>> | null;
}

export interface ExportedSession {
  readonly id: string;
  readonly deviceId: string | null;
  readonly userAgent: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

export interface ExportedDevice {
  readonly id: string;
  readonly platform: string;
  readonly fingerprint: string;
  readonly lastSeenAt: string;
  readonly createdAt: string;
}

export interface ExportedOAuthIdentity {
  readonly id: string;
  readonly provider: string;
  readonly providerEmail: string | null;
  readonly linkedAt: string;
}

export interface ExportedMfaBackupCode {
  readonly id: string;
  readonly used: boolean;
  readonly usedAt: string | null;
  readonly createdAt: string;
}

export interface ExportedTrip {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExportedItineraryDay {
  readonly id: string;
  readonly tripId: string;
  readonly dayIndex: number;
  readonly date: string;
  readonly summary: string | null;
}

export interface ExportedItineraryItem {
  readonly id: string;
  readonly dayId: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly notes: string | null;
  readonly transportMode: string | null;
}

export interface ExportedTripVersion {
  readonly id: string;
  readonly tripId: string;
  readonly versionNo: number;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface ExportedTripShare {
  readonly id: string;
  readonly tripId: string;
  readonly shareCode: string;
  readonly publicRead: boolean;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export interface ExportedScamReport {
  readonly id: string;
  readonly category: string;
  readonly severity: string;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly verified: boolean;
  readonly createdAt: string;
}

export interface ExportedSosEvent {
  readonly id: string;
  readonly trigger: string;
  readonly resolvedAt: string | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
}

export interface ExportedNotificationPreference {
  readonly push: boolean;
  readonly email: boolean;
  readonly sms: boolean;
  readonly quietHours: Readonly<Record<string, unknown>> | null;
}

export interface ExportedNotificationLog {
  readonly id: string;
  readonly channel: string;
  readonly templateId: string;
  readonly status: string;
  readonly read: boolean;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
}

export interface ExportedMediaAsset {
  readonly id: string;
  readonly tripId: string | null;
  readonly memoryBookId: string | null;
  readonly kind: string;
  readonly status: string;
  readonly s3KeyRaw: string;
  readonly takenAt: string | null;
  readonly createdAt: string;
}

export interface ExportedMemoryBook {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly publishedAt: string | null;
  readonly createdAt: string;
}

export interface ExportedVote {
  readonly id: string;
  readonly tripId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly value: number;
  readonly createdAt: string;
}

export interface ExportedExpense {
  readonly id: string;
  readonly tripId: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface ExportedReview {
  readonly id: string;
  readonly tripId: string | null;
  readonly targetType: string;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  readonly createdAt: string;
}

export interface ExportedDishReport {
  readonly id: string;
  readonly eateryId: string;
  readonly name: string;
  readonly priceUsd: string | null;
  readonly createdAt: string;
}

export interface ExportedStayBooking {
  readonly id: string;
  readonly stayId: string;
  readonly provider: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly totalPriceUsd: string;
  readonly createdAt: string;
}

export interface ExportedSubscription {
  readonly id: string;
  readonly status: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly currentPeriodEnd: string;
  readonly cancelAtPeriodEnd: boolean;
  readonly createdAt: string;
}

export interface ExportedEscrowHold {
  readonly id: string;
  readonly agentId: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly state: string;
  readonly heldAt: string;
  readonly releasedAt: string | null;
  readonly refundedAt: string | null;
}

export interface ExportedCommission {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly paidAt: string | null;
  readonly createdAt: string;
}

export interface ExportedAgentProfile {
  readonly id: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly kycStatus: string;
  readonly verifiedAt: string | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly createdAt: string;
}

export interface ExportedLiveEvent {
  readonly id: string;
  readonly tripId: string | null;
  readonly geofenceId: string | null;
  readonly kind: string;
  readonly createdAt: string;
}

export interface UserDataExport {
  readonly metadata: UserDataExportMetadata;
  readonly identity: {
    readonly user: ExportedUser;
    readonly preferences: ExportedPreferences | null;
    readonly sessions: UserDataExportSection<ExportedSession>;
    readonly devices: UserDataExportSection<ExportedDevice>;
    readonly oauthIdentities: UserDataExportSection<ExportedOAuthIdentity>;
    readonly mfaBackupCodes: UserDataExportSection<ExportedMfaBackupCode>;
  };
  readonly trips: UserDataExportSection<ExportedTrip>;
  readonly itineraryDays: UserDataExportSection<ExportedItineraryDay>;
  readonly itineraryItems: UserDataExportSection<ExportedItineraryItem>;
  readonly tripVersions: UserDataExportSection<ExportedTripVersion>;
  readonly tripShares: UserDataExportSection<ExportedTripShare>;
  readonly scamReports: UserDataExportSection<ExportedScamReport>;
  readonly sosEvents: UserDataExportSection<ExportedSosEvent>;
  readonly notificationPreference: ExportedNotificationPreference | null;
  readonly notificationLogs: UserDataExportSection<ExportedNotificationLog>;
  readonly mediaAssets: UserDataExportSection<ExportedMediaAsset>;
  readonly memoryBooks: UserDataExportSection<ExportedMemoryBook>;
  readonly votes: UserDataExportSection<ExportedVote>;
  readonly expenses: UserDataExportSection<ExportedExpense>;
  readonly reviews: UserDataExportSection<ExportedReview>;
  readonly dishReports: UserDataExportSection<ExportedDishReport>;
  readonly stayBookings: UserDataExportSection<ExportedStayBooking>;
  readonly subscriptions: UserDataExportSection<ExportedSubscription>;
  readonly escrowHolds: UserDataExportSection<ExportedEscrowHold>;
  readonly commissions: UserDataExportSection<ExportedCommission>;
  readonly agentProfile: ExportedAgentProfile | null;
  readonly liveEvents: UserDataExportSection<ExportedLiveEvent>;
}
