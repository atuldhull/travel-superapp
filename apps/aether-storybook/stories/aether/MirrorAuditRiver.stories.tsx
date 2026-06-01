/**
 * MirrorAuditRiver story (AE427) — Chromatic baseline for the AE422
 * `<MirrorAuditRiver>`. Three variants cover the visual states:
 *   • Empty — 0 rows ("Audit · live 0 / 0")
 *   • Sparse — 3 rows near the top of the river (just-emitted)
 *   • Full — 6 rows spread top → bottom, fading toward stale
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  ink: '#0C1118',
  accent: '#5384B0',
  surface: '#E3E6EC',
  glow: '#A9C5DE',
};

const GLYPHS = {
  mutation: { color: '#C2614A', symbol: '◆' },
  read: { color: '#F2E8D5', symbol: '•' },
  sos: { color: '#E04A4A', symbol: '!' },
  scam: { color: '#E8B777', symbol: '⚠' },
  'admin-action': { color: '#6E7B5C', symbol: '◉' },
} as const;
type Kind = keyof typeof GLYPHS;

interface Row {
  readonly id: string;
  readonly kind: Kind;
  /** 0..1 — position in the river column (0 = just emitted, 1 = TTL). */
  readonly progress: number;
  readonly summary: string;
}

function River({
  rows,
  total,
}: {
  readonly rows: ReadonlyArray<Row>;
  readonly total: number;
}): React.ReactElement {
  return (
    <div
      style={{
        position: 'relative',
        width: 360,
        height: 520,
        background: COL.ink,
        padding: 24,
        borderRadius: 14,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        color: COL.surface,
      }}
    >
      <header
        style={{
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: COL.glow,
          opacity: 0.7,
          marginBottom: 8,
        }}
      >
        Audit · live {rows.length} / {total}
      </header>
      <div
        style={{
          position: 'relative',
          height: 440,
          borderLeft: `1px solid ${COL.accent}`,
          paddingLeft: 12,
        }}
      >
        {rows.map((row) => {
          const g = GLYPHS[row.kind];
          const opacity = 1 - row.progress * 0.85;
          return (
            <div
              key={row.id}
              style={{
                position: 'absolute',
                top: `${row.progress * 100}%`,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                opacity,
                fontSize: 11,
                lineHeight: 1.3,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: g.color,
                  color: COL.ink,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {g.symbol}
              </span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.summary}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const meta: Meta<typeof River> = {
  title: 'Aether / MirrorAuditRiver',
  component: River,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof River>;

export const Empty: Story = {
  args: { rows: [], total: 0 },
};

export const Sparse: Story = {
  args: {
    rows: [
      {
        id: '1',
        kind: 'mutation',
        progress: 0.05,
        summary: 'admin updated trip 0xa7c4 → archived',
      },
      { id: '2', kind: 'sos', progress: 0.12, summary: 'SOS raised by user 0x12d in Mumbai' },
      { id: '3', kind: 'scam', progress: 0.22, summary: 'Scam report on stay 0xff9 (Jaipur)' },
    ],
    total: 3,
  },
};

export const Full: Story = {
  args: {
    rows: [
      {
        id: '1',
        kind: 'mutation',
        progress: 0.05,
        summary: 'admin updated trip 0xa7c4 → archived',
      },
      { id: '2', kind: 'sos', progress: 0.18, summary: 'SOS raised by user 0x12d in Mumbai' },
      {
        id: '3',
        kind: 'scam',
        progress: 0.32,
        summary: 'Scam report on stay 0xff9 (Jaipur cluster)',
      },
      { id: '4', kind: 'read', progress: 0.5, summary: 'Admin viewed user 0x9ac payments history' },
      {
        id: '5',
        kind: 'admin-action',
        progress: 0.72,
        summary: 'Refund approved on payment 0x4e1 (₹2,400)',
      },
      { id: '6', kind: 'mutation', progress: 0.92, summary: 'Trip 0xb1c published to feed' },
    ],
    total: 6,
  },
};
