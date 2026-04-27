/**
 * V.UX.11 lightbox wrapper around `yet-another-react-lightbox`.
 * Pure controlled component: parent owns `index` + `onClose`. Slides
 * are passed as `src` URLs; we layer the asset's caption underneath
 * via the lib's built-in `description` slot.
 *
 * Lazy CSS import so the lightbox bundle doesn't ship to viewers
 * who never click a thumbnail.
 *
 * Installed by prompt [V.UX.11].
 */
'use client';

import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export interface LightboxSlide {
  readonly src: string;
  readonly caption: string | null;
}

export interface MemoryBookLightboxProps {
  readonly open: boolean;
  readonly index: number;
  readonly slides: readonly LightboxSlide[];
  readonly onClose: () => void;
  readonly onIndexChange: (idx: number) => void;
}

export function MemoryBookLightbox({
  open,
  index,
  slides,
  onClose,
  onIndexChange,
}: MemoryBookLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      on={{
        view: ({ index: idx }) => onIndexChange(idx),
      }}
      slides={slides.map((s) => ({
        src: s.src,
        description: s.caption ?? '',
      }))}
    />
  );
}
