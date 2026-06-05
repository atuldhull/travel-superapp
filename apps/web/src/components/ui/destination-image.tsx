/**
 * DestinationImage — a cinematic, $0 destination photo with a built-in
 * graceful fallback. Resolves a license-clean Wikimedia lead image
 * for `place` (see lib/destination-image) and fades it in over a
 * royal-gradient placeholder. If the lookup misses or the image fails
 * to load, the gradient simply stays — it NEVER renders broken
 * (the app's core "never look broken" rule), so it's safe to drop
 * anywhere without worrying about coverage.
 *
 * Plain <img> (not next/image) on purpose: no remote-pattern config,
 * no optimizer round-trip, lazy by default, and the Wikimedia CDN is
 * already fast + cached. A subtle dark scrim is optional (`scrim`)
 * for text-over-image surfaces.
 *
 * Installed for the imagery pass.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { destinationImage } from '../../lib/destination-image';
import { cn } from '../../lib/cn';

export interface DestinationImageProps {
  readonly place: string;
  readonly alt?: string;
  readonly className?: string;
  /** Add a bottom-up dark scrim (for captions/text over the photo). */
  readonly scrim?: boolean;
  /** Eager-load (above-the-fold hero); default lazy. */
  readonly priority?: boolean;
  readonly rounded?: string;
}

export function DestinationImage({
  place,
  alt,
  className,
  scrim = false,
  priority = false,
  rounded = 'rounded-2xl',
}: DestinationImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setSrc(null);
    setLoaded(false);
    setFailed(false);
    void destinationImage(place).then((u) => {
      if (aliveRef.current) setSrc(u);
    });
    return () => {
      aliveRef.current = false;
    };
  }, [place]);

  const showPhoto = src !== null && !failed;

  return (
    <div
      className={cn('relative isolate overflow-hidden', rounded, className)}
      style={{ backgroundImage: 'var(--gradient-royal)' }}
      aria-hidden={!alt}
    >
      {/* Champagne aura so the placeholder itself looks premium. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/20 blur-3xl"
      />
      {showPhoto ? (
        <img
          src={src}
          alt={alt ?? place}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {scrim ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent"
        />
      ) : null}
    </div>
  );
}
