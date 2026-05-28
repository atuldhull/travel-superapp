'use client';

/**
 * <SafeImg> — img with graceful Aether-styled fallback on 404.
 *
 * Phase 0 destination + journal + atlas data references Unsplash photo
 * IDs that are best-effort, not verified. If any URL 404s, the default
 * `<img>` renders a broken-image icon — ugly on the editorial surfaces.
 *
 * SafeImg listens for the `onError` event and swaps in a calm
 * gradient placeholder + the alt text rendered as small caption.
 * Keeps the page composition intact even when the photo CDN misses.
 *
 * Photographer credit is still rendered in the EditorialFooter — the
 * fallback only replaces the visual, never the attribution.
 */
import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import { useTheme } from '@app/aether-core';

export interface SafeImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
  /** Optional caption to render in the fallback. Default falls back to alt. */
  readonly fallbackLabel?: string;
}

export function SafeImg({ fallbackLabel, alt, style, ...rest }: SafeImgProps): React.ReactElement {
  const theme = useTheme();
  const [failed, setFailed] = useState<boolean>(false);

  const fallback = fallbackLabel ?? (typeof alt === 'string' ? alt : 'Photograph');

  if (failed) {
    const accent = theme.palette.terracotta;
    const ochre = theme.palette.ochre;
    const surface = theme.color.surface;
    const ink = theme.color.ink;
    const placeholderStyle: CSSProperties = {
      ...style,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      background: `linear-gradient(135deg, ${accent.deep} 0%, ${ochre.deep} 50%, ${ink.soft} 100%)`,
      color: surface.base,
      fontFamily: theme.font.ui,
      padding: theme.space.comfy,
    };
    return (
      <div role="img" aria-label={fallback} style={placeholderStyle}>
        <span
          style={{
            fontFamily: theme.font.display,
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.4,
            opacity: 0.92,
            maxWidth: '32ch',
            textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
          }}
        >
          {fallback}
        </span>
      </div>
    );
  }

  return <img alt={alt} onError={() => setFailed(true)} style={style} {...rest} />;
}
