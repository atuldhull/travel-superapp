/**
 * POST.5 — Tiny thumbnail tile used in admin / moderation lists.
 *
 * Behaviour:
 *   - When `src` is a presigned URL, render the image.
 *   - When `src` is null / empty (no thumb variant yet — legacy
 *     CDN-backed seed row, freshly-uploaded image still in the
 *     Sharp pipeline, or a video), render a soft fallback tile
 *     with the asset kind icon.
 *   - `onError` swaps to the fallback if the presigned URL 403s
 *     after TTL expiry — re-fetching the list refreshes URLs.
 *
 * Pure presentation — no fetch in here. The parent passes the
 * already-presigned URL from the api list response.
 */
'use client';

import { useState } from 'react';

interface ThumbnailProps {
  readonly src: string | null;
  readonly alt: string;
  readonly kind?: 'image' | 'video' | string;
  /** Container width/height in pixels. Default 64×64 — matches the
   *  thumbnail variant's intrinsic 256w / 4× DPR tile. */
  readonly size?: number;
}

export function Thumbnail({ src, alt, kind, size = 64 }: ThumbnailProps) {
  const [errored, setErrored] = useState(false);
  const show = src && !errored;
  const px = `${size}px`;
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-muted/15 bg-muted/5 text-xs text-muted"
      style={{ width: px, height: px }}
      aria-label={show ? undefined : `No preview (${kind ?? 'unknown'})`}
    >
      {show ? (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <FallbackIcon kind={kind} />
      )}
    </div>
  );
}

function FallbackIcon({ kind }: { readonly kind?: string }) {
  if (kind === 'video') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="6" width="14" height="12" rx="2" />
        <path d="M17 10l4-2v8l-4-2z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M5 18l5-5 4 4 3-3 4 4" />
    </svg>
  );
}
