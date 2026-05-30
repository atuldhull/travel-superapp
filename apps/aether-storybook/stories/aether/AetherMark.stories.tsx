/**
 * AetherMark story (AE78) — the hand-drawn wordmark glyph that
 * replaces the literal ॐ emoji in DriftNav (originally shipped in
 * AE60). The SVG is duplicated inline here rather than imported from
 * apps/web (storybook lives in its own workspace; importing across
 * apps would require a tsconfig path I'd rather not thread).
 *
 * Three stories: pill on terracotta, outline at 36px, reverse on
 * espresso at 72px. Chromatic baselines guard against shape drift.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface Props {
  readonly size?: number;
  readonly title?: string;
  readonly color?: string;
}

function AetherMark({
  size = 18,
  title = 'Aether',
  color = 'currentColor',
}: Props): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} fill={color}>
      <title>{title}</title>
      <circle
        cx="12"
        cy="11"
        r="6.4"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="4.5" r="1.2" />
      <path
        d="M 12 17.4 C 13.6 18.6, 15.4 19.0, 16.8 18.4 C 18.0 17.9, 18.4 16.6, 17.4 15.8"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="1.05" />
    </svg>
  );
}

function MarkShowcase(): React.ReactElement {
  return (
    <div
      style={{
        padding: 48,
        background: '#F2E8D5',
        minHeight: '100vh',
        fontFamily: 'Söhne, system-ui, sans-serif',
      }}
    >
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          margin: 0,
          color: '#2A1E18',
        }}
      >
        AetherMark
      </h1>
      <p style={{ fontSize: 16, color: '#4A352A', maxWidth: '60ch' }}>
        Hand-drawn SVG glyph replacing the Devanagari ॐ in DriftNav. currentColor-inheriting, scales
        from <code>size</code> prop. Three treatments shown.
      </p>
      <div style={{ display: 'flex', gap: 40, marginTop: 40, alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 999,
              background: '#C2614A',
              color: '#F2E8D5',
            }}
          >
            <AetherMark size={18} />
          </span>
          <p style={{ fontSize: 11, color: '#4A352A', letterSpacing: '0.16em', marginTop: 8 }}>
            PILL · 18px
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 999,
              background: 'transparent',
              border: '1px solid #D6CBB0',
              color: '#9A4836',
            }}
          >
            <AetherMark size={36} />
          </span>
          <p style={{ fontSize: 11, color: '#4A352A', letterSpacing: '0.16em', marginTop: 8 }}>
            OUTLINE · 36px
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 108,
              height: 108,
              borderRadius: 999,
              background: '#180F0B',
              color: '#F2C04A',
            }}
          >
            <AetherMark size={72} />
          </span>
          <p style={{ fontSize: 11, color: '#4A352A', letterSpacing: '0.16em', marginTop: 8 }}>
            REVERSE · 72px
          </p>
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof MarkShowcase> = {
  title: 'Aether / Mark',
  component: MarkShowcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof MarkShowcase>;
export const ThreeTreatments: Story = {};
