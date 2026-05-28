/**
 * Palette story — shows the locked Warm Italian palette + every ramp.
 * Chromatic baseline; any hex shift surfaces in the diff.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { palette, semantic, signal, type ColorRamp } from '@app/aether-motion';

interface SwatchProps {
  name: string;
  value: string;
}

function Swatch({ name, value }: SwatchProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 14,
          background: value,
          boxShadow: '0 1px 2px rgba(42, 30, 24, 0.06)',
        }}
      />
      <div style={{ fontFamily: 'Söhne, system-ui, sans-serif', fontSize: 13, color: '#2A1E18' }}>
        <strong>{name}</strong>
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 11,
          color: '#4A352A',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PaletteShowcase(): React.ReactElement {
  const rows: Array<{ label: string; ramp: ColorRamp }> = [
    { label: 'terracotta — accent', ramp: palette.terracotta },
    { label: 'ochre — highlight', ramp: palette.ochre },
    { label: 'olive — live', ramp: palette.olive },
    { label: 'cream — surface', ramp: palette.cream },
    { label: 'espresso — ink', ramp: palette.espresso },
  ];
  return (
    <div style={{ padding: 32, background: '#F2E8D5', minHeight: '100vh' }}>
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          margin: 0,
          color: '#2A1E18',
        }}
      >
        Warm Italian palette
      </h1>
      <p style={{ fontFamily: 'Söhne, system-ui, sans-serif', fontSize: 16, color: '#4A352A' }}>
        Locked 2026-05-28. Phase 6 commissions a per-destination editorial palette; until then this
        is the brand.
      </p>
      {rows.map((row) => (
        <div key={row.label} style={{ marginTop: 32 }}>
          <h2
            style={{
              fontFamily: 'GT Sectra, Georgia, serif',
              fontSize: 25,
              margin: '0 0 12px',
              color: '#2A1E18',
            }}
          >
            {row.label}
          </h2>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {Object.entries(row.ramp).map(([name, value]) => (
              <Swatch key={name} name={name} value={value} />
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 48 }}>
        <h2
          style={{
            fontFamily: 'GT Sectra, Georgia, serif',
            fontSize: 25,
            margin: '0 0 12px',
            color: '#2A1E18',
          }}
        >
          Semantic roles
        </h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Object.entries(semantic).map(([role, ramp]) => (
            <Swatch key={role} name={role} value={ramp.base} />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 48 }}>
        <h2
          style={{
            fontFamily: 'GT Sectra, Georgia, serif',
            fontSize: 25,
            margin: '0 0 12px',
            color: '#2A1E18',
          }}
        >
          Signal colours
        </h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Object.entries(signal).map(([role, value]) => (
            <Swatch key={role} name={role} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}

const meta: Meta<typeof PaletteShowcase> = {
  title: 'Motion / Palette',
  component: PaletteShowcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PaletteShowcase>;
export const WarmItalian: Story = {};
