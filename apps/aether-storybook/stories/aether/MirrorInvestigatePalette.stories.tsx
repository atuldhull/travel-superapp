/**
 * MirrorInvestigatePalette story (AE427) — Chromatic baseline for the
 * AE424 `<MirrorInvestigatePalette>`. Five variants cover the modes
 * + severity tiers:
 *   • Search — empty query, full suggestion list
 *   • SearchFiltered — query "sha" with highlight, 2 results
 *   • DashboardLow — low-severity user (1 audit mention)
 *   • DashboardMedium — medium-severity (3 audit mentions, blue header)
 *   • DashboardHigh — high-severity (8 audit mentions, red header)
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  ink: '#0C1118',
  accent: '#5384B0',
  surface: '#E3E6EC',
  glow: '#A9C5DE',
  sosRed: '#E04A4A',
};

interface Suggestion {
  readonly id: string;
  readonly displayName: string;
  readonly contextTag: string;
}

const SUGGESTIONS: ReadonlyArray<Suggestion> = [
  { id: 'u_a7c41e9b', displayName: 'Asha Verma', contextTag: '23 trips · Mumbai' },
  { id: 'u_b1c92d34', displayName: 'Vikrant Khanna', contextTag: '11 trips · Goa' },
  { id: 'u_d6f31a87', displayName: 'Aisha Roy', contextTag: '8 trips · Jaipur' },
];

interface Investigation {
  readonly userId: string;
  readonly displayName: string;
  readonly trips: number;
  readonly reviews: number;
  readonly payments: number;
  readonly auditMentions: number;
  readonly summary: string;
}

function severityFor(audits: number): 'low' | 'medium' | 'high' {
  if (audits >= 6) return 'high';
  if (audits >= 2) return 'medium';
  return 'low';
}

function severityColor(sev: 'low' | 'medium' | 'high'): string {
  return sev === 'high' ? COL.sosRed : sev === 'medium' ? COL.glow : COL.accent;
}

function formatCount(n: number): string {
  if (n <= 0) return '—';
  return n.toLocaleString();
}

interface PaletteProps {
  readonly mode: 'search' | 'dashboard';
  readonly query?: string;
  readonly investigation?: Investigation;
  readonly suggestions?: ReadonlyArray<Suggestion>;
  readonly hoverIndex?: number;
}

function Palette({
  mode,
  query = '',
  investigation,
  suggestions = SUGGESTIONS,
  hoverIndex = 0,
}: PaletteProps): React.ReactElement {
  return (
    <div
      style={{
        width: 720,
        background: 'rgba(12, 17, 24, 0.72)',
        padding: 56,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <section
        style={{
          width: 'min(640px, 92vw)',
          background: COL.ink,
          border: `1px solid ${COL.accent}`,
          borderRadius: 14,
          padding: 0,
          overflow: 'hidden',
          color: COL.surface,
          boxShadow: '0 28px 64px rgba(0,0,0,0.6)',
        }}
      >
        {mode === 'search' ? (
          <SearchView query={query} suggestions={suggestions} hoverIndex={hoverIndex} />
        ) : (
          investigation !== undefined && <DashboardView active={investigation} />
        )}
      </section>
    </div>
  );
}

function SearchView({
  query,
  suggestions,
  hoverIndex,
}: {
  readonly query: string;
  readonly suggestions: ReadonlyArray<Suggestion>;
  readonly hoverIndex: number;
}): React.ReactElement {
  const filtered = query
    ? suggestions.filter(
        (s) =>
          s.displayName.toLowerCase().includes(query.toLowerCase()) ||
          s.id.toLowerCase().includes(query.toLowerCase()) ||
          s.contextTag.toLowerCase().includes(query.toLowerCase()),
      )
    : suggestions;
  return (
    <div>
      <header
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${COL.accent}`,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: COL.glow,
          opacity: 0.7,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Investigate user · ⌘K</span>
        <span style={{ fontSize: 18 }}>×</span>
      </header>
      <div
        style={{
          width: '100%',
          padding: '16px 20px',
          fontSize: 16,
          color: query ? COL.surface : 'rgba(227,230,236,0.5)',
        }}
      >
        {query || 'Search by id, name, or context…'}
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          borderTop: `1px solid ${COL.accent}`,
        }}
      >
        {filtered.length === 0 ? (
          <li style={{ padding: '14px 20px', opacity: 0.65, fontSize: 13 }}>
            No users match “{query}”.
          </li>
        ) : (
          filtered.map((s, i) => {
            const q = query.toLowerCase();
            const idx = q ? s.displayName.toLowerCase().indexOf(q) : -1;
            return (
              <li
                key={s.id}
                style={{
                  padding: '10px 20px',
                  background: i === hoverIndex ? 'rgba(83, 132, 176, 0.18)' : 'transparent',
                  borderBottom: '1px solid rgba(83, 132, 176, 0.1)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span>
                  {idx >= 0 ? (
                    <>
                      {s.displayName.slice(0, idx)}
                      <mark
                        style={{
                          background: 'transparent',
                          color: COL.glow,
                          fontWeight: 700,
                        }}
                      >
                        {s.displayName.slice(idx, idx + q.length)}
                      </mark>
                      {s.displayName.slice(idx + q.length)}
                    </>
                  ) : (
                    s.displayName
                  )}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      opacity: 0.6,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {s.contextTag}
                  </span>
                </span>
                <code
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  }}
                >
                  {s.id}
                </code>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function DashboardView({ active }: { readonly active: Investigation }): React.ReactElement {
  const sev = severityFor(active.auditMentions);
  const sevCol = severityColor(sev);
  return (
    <div>
      <header
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${sevCol}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: COL.glow,
          }}
        >
          ← Back
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: sevCol,
            fontWeight: 600,
          }}
        >
          {sev}
        </span>
        <span style={{ fontSize: 18, color: COL.surface }}>×</span>
      </header>
      <div style={{ padding: '18px 20px 6px' }}>
        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 24,
            margin: 0,
            color: COL.surface,
          }}
        >
          {active.displayName}
        </h2>
        <p style={{ fontSize: 13, margin: '4px 0 0', opacity: 0.75 }}>{active.summary}</p>
        <code
          style={{
            display: 'block',
            fontSize: 11,
            opacity: 0.55,
            marginTop: 4,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {active.userId}
        </code>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          margin: '18px 0 0',
          background: 'rgba(83, 132, 176, 0.12)',
        }}
      >
        {[
          { label: 'Trips', value: active.trips },
          { label: 'Reviews', value: active.reviews },
          { label: 'Payments', value: active.payments },
          { label: 'Audit mentions', value: active.auditMentions, severityKey: true as const },
        ].map((tile) => (
          <div key={tile.label} style={{ padding: '14px 20px', background: COL.ink }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                opacity: 0.65,
                display: 'block',
              }}
            >
              {tile.label}
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: 26,
                color: tile.severityKey === true ? sevCol : 'inherit',
                fontWeight: 600,
              }}
            >
              {formatCount(tile.value)}
            </span>
          </div>
        ))}
      </div>
      <footer
        style={{
          padding: '12px 20px 16px',
          fontSize: 11,
          opacity: 0.6,
        }}
      >
        Last audit-mention: 4h ago · backend wiring lands in AE424b.
      </footer>
    </div>
  );
}

const meta: Meta<typeof Palette> = {
  title: 'Aether / MirrorInvestigatePalette',
  component: Palette,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Palette>;

export const Search: Story = {
  args: { mode: 'search', query: '', hoverIndex: 0 },
};

export const SearchFiltered: Story = {
  args: { mode: 'search', query: 'sha', hoverIndex: 0 },
};

export const DashboardLow: Story = {
  args: {
    mode: 'dashboard',
    investigation: {
      userId: 'u_a7c41e9b',
      displayName: 'Asha Verma',
      trips: 23,
      reviews: 41,
      payments: 19,
      auditMentions: 1,
      summary: 'Heavy traveller · all green · 1 admin note on refund request',
    },
  },
};

export const DashboardMedium: Story = {
  args: {
    mode: 'dashboard',
    investigation: {
      userId: 'u_d6f31a87',
      displayName: 'Aisha Roy',
      trips: 8,
      reviews: 7,
      payments: 6,
      auditMentions: 3,
      summary: 'Recently flagged · review-moderation queue · medium attention',
    },
  },
};

export const DashboardHigh: Story = {
  args: {
    mode: 'dashboard',
    investigation: {
      userId: 'u_9ac4f72d',
      displayName: 'Ravi Joshi',
      trips: 6,
      reviews: 5,
      payments: 4,
      auditMentions: 8,
      summary: 'High-attention · 8 audit mentions · 2 scam reports pending',
    },
  },
};
