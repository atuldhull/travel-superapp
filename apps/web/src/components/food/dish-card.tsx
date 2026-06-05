/**
 * V.UX.20 — dish card for the foodie persona. Renders the dish
 * name, price (if known), photo (if known), and the foodie's
 * caption. Designed for vertical lists on the eatery detail page
 * and for the dish-of-the-day strip on city pages.
 *
 * Photos render through a plain <img> (no next/image) so external
 * URLs work without next.config domain whitelisting — V.UX.20
 * accepts any URL via the api.
 *
 * Installed by prompt [V.UX.20].
 */
'use client';

import type { DishDto } from '@app/sdk';

interface DishCardProps {
  readonly dish: DishDto;
}

export function DishCard({ dish }: DishCardProps) {
  // Orval emits nullable string fields as `{[k:string]: unknown} | null`.
  // Cast through `unknown` to the canonical `string | null` shape.
  const photoUrl = dish.photoUrl as unknown as string | null;
  const priceUsd = dish.priceUsd as unknown as string | null;
  const caption = dish.caption as unknown as string | null;
  return (
    <li className="overflow-hidden rounded-2xl border border-gold-600/12 bg-surface text-sm shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)">
      {photoUrl ? (
        <div className="aspect-4/3 w-full overflow-hidden bg-muted/10">
          <img
            src={photoUrl}
            alt={dish.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="space-y-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-display text-base font-semibold tracking-tight text-surface-foreground">
            {dish.name}
          </p>
          {priceUsd ? (
            <span className="shrink-0 rounded-full bg-gold-500/12 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-700 ring-1 ring-inset ring-gold-500/35 dark:text-gold-300">
              ${priceUsd}
            </span>
          ) : null}
        </div>
        {caption ? <p className="text-xs leading-relaxed text-muted">{caption}</p> : null}
        <p className="text-[10px] text-muted/70">{new Date(dish.createdAt).toLocaleDateString()}</p>
      </div>
    </li>
  );
}
