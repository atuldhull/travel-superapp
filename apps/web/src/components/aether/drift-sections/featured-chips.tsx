'use client';

/**
 * Featured chips strip — sits under the hero CTA.
 *
 * Each chip surfaces a single "what's happening now" cue (Diwali in
 * Varanasi, Pushkar Mela, monsoon in Kerala). They're tiny but they
 * earn the page a brand voice — the product is opinionated about
 * when to go where.
 */
import { useTheme } from '@app/aether-core';
import { SEASON_CHIPS } from '../photos';

export function FeaturedChips(): React.ReactElement {
  const theme = useTheme();
  return (
    <div
      role="list"
      aria-label="Featured seasons"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.space.tight,
        marginTop: theme.space.comfy,
      }}
    >
      {SEASON_CHIPS.map((c) => (
        <span
          key={c.place}
          role="listitem"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: `6px ${theme.space.inline}px`,
            borderRadius: theme.radius.pill,
            background: 'rgba(242, 232, 213, 0.14)',
            border: `1px solid rgba(242, 232, 213, 0.22)`,
            fontFamily: theme.font.ui,
            fontSize: theme.text.small.size,
            color: theme.color.surface.base,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: theme.palette.ochre.glow,
              fontWeight: 600,
            }}
          >
            {c.label}
          </span>
          <span style={{ opacity: 0.92 }}>{c.place}</span>
        </span>
      ))}
    </div>
  );
}
