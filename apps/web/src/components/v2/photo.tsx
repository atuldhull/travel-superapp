/**
 * v2 photo — a reliable premium image tile. Renders a curated Unsplash
 * photo by id (the same ids the app already ships in its destination
 * data) and, if it ever fails to load, degrades to a warm royal
 * gradient — never a broken image, never a wrong stock fallback.
 */
'use client';

import { useState } from 'react';
import { cn } from '../../lib/cn';

export interface V2PhotoProps {
  readonly id: string;
  readonly alt?: string;
  readonly className?: string;
  readonly rounded?: string;
  readonly scrim?: boolean;
  readonly priority?: boolean;
  readonly width?: number;
}

export function V2Photo({
  id,
  alt = '',
  className,
  rounded = 'rounded-2xl',
  scrim = false,
  priority = false,
  width = 1200,
}: V2PhotoProps): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={cn('relative isolate overflow-hidden', rounded, className)}
      style={{ backgroundImage: 'var(--gradient-royal)' }}
      aria-hidden={alt === ''}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/20 blur-3xl"
      />
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`}
          alt={alt}
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
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
        />
      ) : null}
    </div>
  );
}
