/**
 * Skeleton — animated placeholder bars for loading states. Three modes:
 *
 *   - `Skeleton`           : a single line (default) or stack
 *                            (`count > 1`) — the original V.UX.27 shape.
 *   - `<SkeletonList>`     : N rows, each two lines (title + meta).
 *                            Drop-in for `<ul>` placeholders. (POST.8)
 *   - `<SkeletonCard>`     : title + 3 lines + footer block. Drop-in
 *                            for trip / memory-book card grids. (POST.8)
 *
 * All variants use `aria-hidden` so screen readers don't read pulse
 * placeholders. Use `aria-busy="true"` on the parent container so AT
 * users know "loading" without parsing the placeholders themselves.
 *
 * Installed by prompt [IV.18.19.27]; list+card variants in [POST.8].
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

interface SkeletonListProps {
  /** Number of rows to render. Default 3. */
  readonly rows?: number;
  /** Apply to the <ul> wrapper. */
  readonly className?: string;
}

export function SkeletonList({ rows = 3, className }: SkeletonListProps) {
  return (
    <ul aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="space-y-2 rounded-md border border-muted/15 bg-surface px-3 py-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/20" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted/15" />
        </li>
      ))}
    </ul>
  );
}

interface SkeletonCardProps {
  /** Number of cards to render in the grid. Default 1. */
  readonly count?: number;
  readonly className?: string;
}

export function SkeletonCard({ count = 1, className }: SkeletonCardProps) {
  return (
    <div aria-hidden="true" className={cn('grid gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-md border border-muted/15 bg-surface p-4">
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted/20" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted/15" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted/15" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-muted/15" />
          </div>
          <div className="h-7 w-28 animate-pulse rounded bg-muted/15" />
        </div>
      ))}
    </div>
  );
}
