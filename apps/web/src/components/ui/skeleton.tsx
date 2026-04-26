/**
 * Skeleton — animated placeholder bar. Used for loading states on
 * lists / cards while React Query is fetching. Defaults to a single
 * line; pass `count` for a stack and `className` for height/width
 * tweaks.
 *
 * Installed by prompt [IV.18.19.27].
 */
import { cn } from '../../lib/cn';

interface SkeletonProps {
  readonly className?: string;
  readonly count?: number;
}

export function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('h-4 w-full animate-pulse rounded bg-muted/15', className)} />
      ))}
    </div>
  );
}
