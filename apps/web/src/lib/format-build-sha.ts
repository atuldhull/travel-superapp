/**
 * AE349 — pure formatter for the AE75 build SHA stamp.
 *
 * Editorial footer + status page both surface
 * `NEXT_PUBLIC_BUILD_SHA` (set at deploy). Display rule is "first 7
 * chars" (git-style short SHA). Centralised so a future "use 12
 * chars" / "drop to 5" change lands here.
 *
 * Returns null when the input is null / undefined / empty after
 * trimming — so the caller chooses the placeholder copy ("—",
 * "(unset)", "(set NEXT_PUBLIC_BUILD_SHA…)").
 */

export const SHORT_SHA_LENGTH = 7;

export function formatBuildSha(sha: unknown): string | null {
  if (typeof sha !== 'string') return null;
  const trimmed = sha.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, SHORT_SHA_LENGTH);
}
