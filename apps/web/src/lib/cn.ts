/**
 * `cn()` — class-name merger used by every UI primitive.
 *
 * `clsx` deals with the conditional / array / object inputs; then
 * `twMerge` resolves Tailwind class collisions (e.g. consumer passes
 * `className="px-2"` and the primitive's default is `px-4` → twMerge
 * keeps the consumer's `px-2`). This pattern is the de-facto contract
 * for shadcn-style components and is what every UI primitive in
 * `src/components/ui/` expects.
 *
 * Installed by prompt [IV.18.19.23].
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
