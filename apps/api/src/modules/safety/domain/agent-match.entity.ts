/**
 * V.UX.17 — read-shape returned by the agent-match flow. Mirrors a
 * verified-agent row enough to render the concierge picker without
 * round-tripping per row (no userId — premium callers don't get
 * the underlying user's id from this surface).
 *
 * `kycStatus` always equals 'verified' on returned rows by
 * construction (the use-case filters); we expose it explicitly so
 * the UI can label the badge.
 *
 * Installed by prompt [V.UX.17].
 */
export interface AgentMatch {
  readonly id: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly verifiedAt: Date;
}
