/**
 * Pulse drawer story (AE174) — Chromatic baseline for the AE19 +
 * AE21 + AE85 + AE132 chat surface. Four static variants:
 *   • EmptyFirstTimer — no history; shows the AE132 "Try one of these"
 *     seed strip + AE85 quick paths.
 *   • RecentReturning — has 4 recent prompts; the AE106 strip wins,
 *     the seed strip is hidden.
 *   • InConversation — 4 message bubbles + the AE159 pending phrase.
 *   • SlashOpen — slash palette expanded (`/jaipur` filter active).
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  inkWhisper: '#D6CBB0',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochreDeep: '#8A5F31',
  ochreGlow: '#D9A66B',
  olive: '#6E7B5C',
  oliveWhisper: '#D9DCC8',
};

interface ChatBubble {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

interface PulseProps {
  readonly recent?: ReadonlyArray<string>;
  readonly suggested?: ReadonlyArray<string>;
  readonly messages?: ReadonlyArray<ChatBubble>;
  readonly pending?: boolean;
  readonly pendingPhrase?: string;
  readonly slashOpen?: boolean;
  readonly slashFilter?: string;
}

function PulseDrawer({
  recent = [],
  suggested = [],
  messages = [],
  pending = false,
  pendingPhrase = 'Reading…',
  slashOpen = false,
  slashFilter = '',
}: PulseProps): React.ReactElement {
  return (
    <div
      style={{
        background: '#0E0908',
        minHeight: '100vh',
        padding: 24,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 380,
          maxHeight: 560,
          background: COL.cream,
          borderRadius: 16,
          border: `1px solid ${COL.inkWhisper}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: 12,
            borderBottom: `1px solid ${COL.oliveWhisper}`,
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: COL.terracottaDeep,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Pulse
          </p>
          <span style={{ color: COL.inkSoft, fontSize: 16 }}>×</span>
        </div>

        {/* Body */}
        <div
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {messages.length === 0 && !pending && (
            <>
              <p
                style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 17,
                  color: COL.ink,
                  margin: '4px 0 8px',
                }}
              >
                How can the journey help today?
              </p>
              {recent.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: COL.ochreDeep,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Recent
                  </span>
                  {recent.slice(0, 3).map((r) => (
                    <div
                      key={r}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: '1px solid #F2E0BB',
                        fontFamily: 'Playfair Display, Georgia, serif',
                        fontStyle: 'italic',
                        fontSize: 13,
                        color: COL.ink,
                      }}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
              {suggested.length > 0 && recent.length < 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#4F5841',
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Try one of these
                  </span>
                  {suggested.map((p) => (
                    <div
                      key={p}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 4,
                        border: `1px solid ${COL.oliveWhisper}`,
                        fontFamily: 'Playfair Display, Georgia, serif',
                        fontStyle: 'italic',
                        fontSize: 13,
                        color: COL.ink,
                      }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                padding: '8px 12px',
                borderRadius: 12,
                background: m.role === 'user' ? COL.terracotta : COL.cream,
                color: m.role === 'user' ? COL.cream : COL.ink,
                fontFamily:
                  m.role === 'user'
                    ? 'Inter, system-ui, sans-serif'
                    : 'Playfair Display, Georgia, serif',
                fontSize: m.role === 'user' ? 13 : 14,
                border: m.role === 'assistant' ? `1px solid ${COL.inkWhisper}` : 'none',
              }}
            >
              {m.content}
            </div>
          ))}
          {pending && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                borderRadius: 12,
                background: COL.cream,
                border: `1px solid ${COL.inkWhisper}`,
                fontFamily: 'Playfair Display, Georgia, serif',
                fontStyle: 'italic',
                fontSize: 14,
                color: COL.inkSoft,
              }}
            >
              {pendingPhrase}
            </div>
          )}
        </div>

        {/* Slash palette */}
        {slashOpen && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveWhisper}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {['/jaipur', '/leh', '/alleppey'].map((s) => (
              <div
                key={s}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: COL.ink,
                  padding: '2px 6px',
                  background: s.includes(slashFilter) ? COL.oliveWhisper : 'transparent',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Composer */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: `1px solid ${COL.oliveWhisper}`,
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            placeholder="Ask anything…"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${COL.inkWhisper}`,
              background: COL.cream,
              fontSize: 13,
            }}
          />
          <span
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              background: COL.terracotta,
              color: COL.cream,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Ask
          </span>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof PulseDrawer> = {
  title: 'Aether / Pulse',
  component: PulseDrawer,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PulseDrawer>;

export const EmptyFirstTimer: Story = {
  args: {
    suggested: [
      'A slow five days somewhere in season near me.',
      'Plan two weekends back-to-back — one for ruins, one for the coast.',
      'Where should I go that nobody Instagram-knows yet?',
    ],
  },
};

export const RecentReturning: Story = {
  args: {
    recent: ['Five days in Leh', 'A weekend in Anjuna', 'A trip to Varanasi'],
  },
};

export const InConversation: Story = {
  args: {
    messages: [
      { role: 'user', content: 'Plan five days near Jaipur with low crowds.' },
      {
        role: 'assistant',
        content:
          'Day 1: arrive Jaipur, settle in Hawa Mahal area. Day 2: morning Amer Fort, afternoon Galta Ji…',
      },
      { role: 'user', content: 'Can you make it a bit slower?' },
    ],
    pending: true,
    pendingPhrase: 'Sketching the route…',
  },
};

export const SlashOpen: Story = {
  args: {
    slashOpen: true,
    slashFilter: 'jai',
  },
};
