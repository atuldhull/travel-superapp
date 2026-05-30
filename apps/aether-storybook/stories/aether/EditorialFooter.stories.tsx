/**
 * EditorialFooter story (AE181) — Chromatic baseline for the AE8
 * multi-column sitemap + newsletter footer that mounts on every
 * Aether shell. Two variants: Default (build SHA hidden) + WithBuild
 * (AE157 SHA visible).
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  inkWhisper: '#D6CBB0',
  terracotta: '#C2614A',
  ochreGlow: '#D9A66B',
};

interface FooterProps {
  readonly buildSha?: string;
}

interface FooterColumn {
  readonly title: string;
  readonly links: ReadonlyArray<string>;
}

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    title: 'Explore',
    links: [
      'Royal heritage',
      'Regional cuisine',
      'Himalayan retreats',
      'Coastal soul',
      'All regions',
    ],
  },
  {
    title: 'Journey with us',
    links: ['Begin a yatra', 'Voices', 'The journal', 'Become a host'],
  },
  {
    title: 'About',
    links: ['Our promise', 'Sustainability', 'Contact', 'Privacy & terms'],
  },
];

function StaticFooter({ buildSha }: FooterProps): React.ReactElement {
  return (
    <div style={{ background: COL.cream, minHeight: '100vh' }}>
      <div style={{ padding: 64, textAlign: 'center', color: COL.inkSoft }}>
        Page body would render here.
      </div>
      <footer
        role="contentinfo"
        style={{
          background: COL.ink,
          color: COL.cream,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            padding: '64px 32px',
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 1.5fr) repeat(3, minmax(160px, 1fr))',
            gap: 32,
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: COL.terracotta,
                  color: COL.cream,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                ॐ
              </span>
              <span
                style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 26,
                  fontWeight: 600,
                  color: COL.cream,
                }}
              >
                TravelSuperApp
              </span>
            </div>
            <p
              style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: 19,
                fontStyle: 'italic',
                lineHeight: 1.5,
                maxWidth: '32ch',
                color: COL.cream,
                opacity: 0.85,
                margin: 0,
              }}
            >
              Travel that knows the country it walks through.
            </p>
            <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
              <span
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: `1px solid rgba(242, 232, 213, 0.22)`,
                  background: 'rgba(242, 232, 213, 0.08)',
                  color: COL.cream,
                  fontSize: 13,
                }}
              >
                your@email
              </span>
              <span
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: COL.terracotta,
                  color: COL.cream,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Subscribe
              </span>
            </div>
          </div>
          {/* Columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: COL.ochreGlow,
                  margin: 0,
                  marginBottom: 16,
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
                  gap: 8,
                }}
              >
                {col.links.map((l) => (
                  <li
                    key={l}
                    style={{
                      fontSize: 14,
                      color: COL.cream,
                      opacity: 0.85,
                    }}
                  >
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          style={{
            borderTop: `1px solid rgba(242, 232, 213, 0.12)`,
            padding: '20px 32px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: COL.cream,
              opacity: 0.55,
            }}
          >
            © 2026 TravelSuperApp · Aether Phase 0 preview
            {buildSha !== undefined && (
              <span style={{ opacity: 0.7 }}> · build {buildSha.slice(0, 7)}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

const meta: Meta<typeof StaticFooter> = {
  title: 'Aether / EditorialFooter',
  component: StaticFooter,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof StaticFooter>;

export const Default: Story = { args: {} };
export const WithBuildSha: Story = { args: { buildSha: 'b1f31debeefcafe' } };
