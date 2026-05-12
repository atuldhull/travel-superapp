/**
 * POST.8 — `<RelativeTime>` — semantic `<time>` element with the
 * relative formatter ("3 hours ago") inside and the full ISO in the
 * `title` attribute (browser tooltip on hover) + `dateTime` (machine
 * readable for screen readers / parsers). Re-renders every minute
 * so "just now" rolls to "1 minute ago" without a page reload.
 *
 * Pure presentation — caller passes a Date / string / number.
 */
'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '../../lib/relative-time';

interface RelativeTimeProps {
  readonly at: Date | string | number;
  /** Optional className for sizing / colouring the element. */
  readonly className?: string;
}

const TICK_MS = 60_000;

export function RelativeTime({ at, className }: RelativeTimeProps) {
  const date = at instanceof Date ? at : new Date(at);
  const iso = Number.isNaN(date.getTime()) ? '' : date.toISOString();
  const [, force] = useState(0);

  useEffect(() => {
    const handle = window.setInterval(() => force((n) => n + 1), TICK_MS);
    return () => window.clearInterval(handle);
  }, []);

  return (
    <time className={className} dateTime={iso} title={iso || undefined}>
      {formatRelativeTime(at)}
    </time>
  );
}
