/**
 * AE372 — Chromatic baseline for the AE364 @-mention autocomplete
 * drawer. Renders the same listbox markup as `pulse.tsx`, but with
 * fixture data + selected-index control so the Chromatic snapshot
 * locks the highlight + typography contract.
 */
import type { Meta, StoryObj } from '@storybook/react';

const theme = {
  color: {
    surface: { base: '#F2E8D5' },
    ink: { base: '#180F0B', soft: '#5C4A3B', whisper: '#CFC4B3' },
  },
  palette: {
    terracotta: { base: '#C2614A', deep: '#9A4836' },
    ochre: { glow: '#E8B777' },
    olive: { base: '#6E7B5C', whisper: 'rgba(110, 123, 92, 0.18)' },
  },
  font: {
    ui: 'Inter, system-ui, sans-serif',
    display: 'Playfair Display, Georgia, serif',
    mono: 'JetBrains Mono, monospace',
  },
  radius: { sm: 6 },
};

interface Match {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
}

interface DrawerProps {
  readonly matches: ReadonlyArray<Match>;
  readonly selectedIdx: number;
  readonly composerText: string;
}

function MentionDrawer({ matches, selectedIdx, composerText }: DrawerProps): React.ReactElement {
  return (
    <div
      style={{
        background: '#1A0F09',
        padding: 48,
        minHeight: '100vh',
        fontFamily: theme.font.ui,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 520,
          background: theme.color.surface.base,
          padding: 24,
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Drawer */}
        <div
          role="listbox"
          aria-label="Destination mention suggestions"
          style={{
            paddingTop: 8,
            borderTop: `1px solid ${theme.palette.olive.whisper}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {matches.map((m, idx) => {
            const isActive = idx === selectedIdx;
            return (
              <div
                key={m.slug}
                role="option"
                aria-selected={isActive}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  borderRadius: theme.radius.sm,
                  background: isActive ? theme.palette.olive.whisper : 'transparent',
                  fontFamily: theme.font.ui,
                }}
              >
                <code
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    color: theme.palette.terracotta.deep,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  @{m.slug}
                </code>
                <span
                  style={{
                    fontFamily: theme.font.display,
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: theme.color.ink.base,
                    lineHeight: 1.3,
                  }}
                >
                  {m.name}, {m.state}
                </span>
                <span
                  aria-hidden
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 10,
                    color: theme.color.ink.soft,
                    opacity: 0.65,
                    letterSpacing: '0.1em',
                  }}
                >
                  ↵
                </span>
              </div>
            );
          })}
        </div>

        {/* Composer hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 999,
            background: theme.color.surface.base,
            border: `1px solid ${theme.color.ink.whisper}`,
            fontFamily: theme.font.ui,
            fontSize: 13,
            color: theme.color.ink.base,
          }}
        >
          <span style={{ opacity: 0.6 }}>›</span>
          <code style={{ fontFamily: theme.font.mono, fontSize: 12 }}>{composerText}</code>
          <span aria-hidden style={{ marginLeft: 'auto', color: theme.color.ink.soft }}>
            ↑↓ select · ↵ insert
          </span>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof MentionDrawer> = {
  title: 'Aether / PulseMentionDrawer',
  component: MentionDrawer,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof MentionDrawer>;

const ALL = [
  { slug: 'leh', name: 'Leh', state: 'Ladakh' },
  { slug: 'alleppey', name: 'Alleppey', state: 'Kerala' },
  { slug: 'anjuna', name: 'Anjuna', state: 'Goa' },
  { slug: 'darjeeling', name: 'Darjeeling', state: 'West Bengal' },
  { slug: 'spiti', name: 'Spiti', state: 'Himachal Pradesh' },
];

export const PartialQuery: Story = {
  args: {
    matches: ALL.slice(0, 3),
    selectedIdx: 0,
    composerText: 'Plan @a',
  },
};

export const HighlightSecond: Story = {
  args: {
    matches: ALL,
    selectedIdx: 1,
    composerText: 'Plan @',
  },
};

export const NarrowedToOne: Story = {
  args: {
    matches: [{ slug: 'leh', name: 'Leh', state: 'Ladakh' }],
    selectedIdx: 0,
    composerText: 'Plan @leh',
  },
};
