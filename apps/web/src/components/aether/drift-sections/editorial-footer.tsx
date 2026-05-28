'use client';

/**
 * Editorial footer — multi-column sitemap on a deep-espresso band.
 *
 * Replaces the cramped credits strip with a proper magazine footer:
 *   • Wordmark + tagline + newsletter CTA on the left
 *   • Three columns of links (Explore / Company / Legal)
 *   • Tiny photo credit + © strip on the bottom
 */
import Link from 'next/link';
import { useTheme } from '@app/aether-core';
import { HERO, EXPERIENCES, GUSTARE, REGIONS, JOURNAL, creditUrl } from '../photos';

interface FooterColumn {
  readonly title: string;
  readonly links: ReadonlyArray<{ label: string; href: string }>;
}

const COLUMNS: readonly FooterColumn[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Royal heritage', href: '#esperienze' },
      { label: 'Regional cuisine', href: '#esperienze' },
      { label: 'Himalayan retreats', href: '#esperienze' },
      { label: 'Coastal soul', href: '#esperienze' },
      { label: 'All regions', href: '#regions' },
    ],
  },
  {
    title: 'Journey with us',
    links: [
      { label: 'Begin a yatra', href: '/home' },
      { label: 'Voices', href: '#voices' },
      { label: 'The journal', href: '#blog' },
      { label: 'Become a host', href: '/me/agent' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Our promise', href: '#trust' },
      { label: 'Sustainability', href: '#trust' },
      { label: 'Contact', href: '/me/agent' },
      { label: 'Privacy & terms', href: '/legal/privacy' },
    ],
  },
];

export function EditorialFooter(): React.ReactElement {
  const theme = useTheme();
  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;

  return (
    <footer
      role="contentinfo"
      style={{
        background: ink.base,
        color: surface.base,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: `${theme.space.hero}px ${theme.space.margin}px`,
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1.5fr) repeat(3, minmax(160px, 1fr))',
          gap: theme.space.gutter,
        }}
      >
        {/* Brand column */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.space.tight,
              marginBottom: theme.space.comfy,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                fontFamily: theme.font.display,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              ॐ
            </span>
            <span
              style={{
                fontFamily: theme.font.display,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: surface.base,
              }}
            >
              TravelSuperApp
            </span>
          </div>
          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 19,
              fontStyle: 'italic',
              lineHeight: 1.5,
              maxWidth: '32ch',
              color: surface.soft,
              opacity: 0.85,
              margin: 0,
            }}
          >
            Travel that knows the country it walks through.
          </p>
          <form
            style={{
              marginTop: theme.space.loose,
              display: 'flex',
              gap: theme.space.tight,
              maxWidth: 360,
            }}
            onSubmit={(e) => {
              e.preventDefault();
              // Phase 0 stub — newsletter wiring lands with email service.
            }}
          >
            <input
              type="email"
              required
              placeholder="your@email"
              aria-label="Email for the journal"
              style={{
                flex: 1,
                padding: `${theme.space.tight}px ${theme.space.inline}px`,
                borderRadius: theme.radius.pill,
                border: `1px solid rgba(242, 232, 213, 0.22)`,
                background: 'rgba(242, 232, 213, 0.08)',
                color: surface.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                border: 'none',
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                fontWeight: 600,
                letterSpacing: '0.01em',
                cursor: 'pointer',
              }}
            >
              Subscribe
            </button>
          </form>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: 11,
              color: surface.soft,
              opacity: 0.6,
              marginTop: theme.space.tight,
              maxWidth: 360,
            }}
          >
            One letter a month. Long-form field notes, no marketing.
          </p>
        </div>

        {/* Three link columns */}
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: ochre.glow,
                margin: 0,
                marginBottom: theme.space.comfy,
              }}
            >
              {col.title}
            </h4>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: theme.space.tight,
              }}
            >
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.body.size,
                      color: surface.soft,
                      textDecoration: 'none',
                      opacity: 0.85,
                    }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom strip: credits + © */}
      <div
        style={{
          borderTop: `1px solid rgba(242, 232, 213, 0.12)`,
          padding: `${theme.space.comfy}px ${theme.space.margin}px`,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: theme.space.tight,
            fontFamily: theme.font.mono,
            fontSize: 11,
            color: surface.soft,
            opacity: 0.55,
          }}
        >
          <span>© {new Date().getFullYear()} TravelSuperApp · Aether Phase 0 preview</span>
          <span>
            Photography on Unsplash by{' '}
            {[HERO, ...EXPERIENCES, GUSTARE, ...REGIONS, ...JOURNAL].map((p, i, arr) => (
              <span key={`${p.id}-${i}`}>
                <a
                  href={creditUrl(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  {p.by}
                </a>
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
