/**
 * AE250 — pure share-list statistics derivation.
 *
 * /me/shares + journey-dashboard each surface "X live shares,
 * most recent <when>". Today they each compute this inline. This
 * helper canonicalises:
 *
 *   total        - shares with a non-null createdAt
 *   revoked      - shares with a revokedAt set
 *   live         - total - revoked
 *   mostRecentAt - max createdAt across non-revoked shares
 *                  (null if none)
 */

export interface ShareLike {
  readonly createdAt: string | null;
  readonly revokedAt?: string | null;
}

export interface ShareListStats {
  readonly total: number;
  readonly revoked: number;
  readonly live: number;
  readonly mostRecentAt: string | null;
}

function isLive(s: ShareLike): boolean {
  return s.revokedAt === null || s.revokedAt === undefined || s.revokedAt === '';
}

export function computeShareListStats(shares: ReadonlyArray<ShareLike>): ShareListStats {
  let total = 0;
  let revoked = 0;
  let mostRecentAt: string | null = null;
  let mostRecentTs = Number.NEGATIVE_INFINITY;
  for (const s of shares) {
    if (s.createdAt === null) continue;
    total += 1;
    if (isLive(s) === false) {
      revoked += 1;
      continue;
    }
    const t = new Date(s.createdAt).getTime();
    if (Number.isFinite(t) && t > mostRecentTs) {
      mostRecentTs = t;
      mostRecentAt = s.createdAt;
    }
  }
  return { total, revoked, live: total - revoked, mostRecentAt };
}
