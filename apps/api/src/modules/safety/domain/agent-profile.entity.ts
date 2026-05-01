/**
 * V.UX.24 — agent / local-guide caller-self surfaces. Plain-data
 * shapes only; persistence stays behind `AgentRepository`.
 *
 * Splits intentionally:
 *   - `AgentProfile` is the editable row the agent owns (bio,
 *     languages, regions, displayName) plus the read-only KYC
 *     status + rating aggregates.
 *   - `AgentBookingSummary` is the dashboard's compact booking
 *     row — full EscrowHold has more fields than the agent UI
 *     needs.
 *   - `AgentEarningsSummary` collapses the booking list into a
 *     dashboard total + count.
 *   - `AgentReviewWithResponse` mirrors the existing Review row
 *     plus the V.UX.24 `responseBody` / `responseAt` reply.
 *
 * Installed by prompt [V.UX.24].
 */
export type AgentKycStatus = 'pending' | 'verified' | 'rejected';

export interface AgentProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly kycStatus: AgentKycStatus;
  readonly verifiedAt: Date | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type AgentEscrowState = 'held' | 'released' | 'refunded' | 'disputed';

export interface AgentBookingSummary {
  readonly id: string;
  readonly userId: string;
  readonly amountUsd: string; // Prisma Decimal → 2-decimal string.
  readonly currency: string;
  readonly state: AgentEscrowState;
  readonly heldAt: Date;
  readonly releasedAt: Date | null;
  readonly refundedAt: Date | null;
}

export interface AgentEarningsSummary {
  readonly grossUsd: string; // 2-decimal string.
  readonly bookingsCount: number;
}

export interface AgentReviewWithResponse {
  readonly id: string;
  readonly authorId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  readonly responseBody: string | null;
  readonly responseAt: Date | null;
  readonly createdAt: Date;
}
