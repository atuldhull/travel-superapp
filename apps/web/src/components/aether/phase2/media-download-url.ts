/**
 * AE401 — pure extractor for `MediaDownloadUrlResponseDto`.
 *
 * The orval schema ships `@ts-nocheck` so the runtime shape is
 * `{url: string, expiresAt: string}` while React Query envelopes it as
 * `{data: dto, status: 200}`. The extractor lives in its own module so
 * tests can pin the safe-coercion behaviour (null / undefined / partial
 * responses → null URL) without booting the SDK.
 */
import type { MediaDownloadUrlResponseDto } from '@app/sdk';

/** Pull the presigned URL from a download-URL response, or null when
 *  the response isn't ready / is malformed. Returns null when:
 *    - the response is null / undefined
 *    - the `url` field is missing / not a string
 *    - the `url` field is the empty string
 *
 *  The caller passes the unwrapped `dto.data` shape (see orval's
 *  `mediaControllerDownloadUrlResponse200`).
 */
export function extractDownloadUrl(
  dto: MediaDownloadUrlResponseDto | null | undefined,
): string | null {
  if (dto === null || dto === undefined) return null;
  const url = (dto as { url?: unknown }).url;
  if (typeof url !== 'string' || url === '') return null;
  return url;
}

/** Companion: read the `expiresAt` ISO timestamp from the same DTO.
 *  Null when missing / malformed. Used by future cache-eviction logic
 *  (the presigned URL has a ~5 min TTL per the API contract). */
export function extractDownloadExpiresAt(
  dto: MediaDownloadUrlResponseDto | null | undefined,
): string | null {
  if (dto === null || dto === undefined) return null;
  const v = (dto as { expiresAt?: unknown }).expiresAt;
  if (typeof v !== 'string' || v === '') return null;
  return v;
}
