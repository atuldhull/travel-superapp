/**
 * Typography story — every named text-style on the cream surface.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { textStyle } from '@app/aether-motion';

function TypographyShowcase(): React.ReactElement {
  const order: Array<keyof typeof textStyle> = [
    'display',
    'hero',
    'title',
    'subhead',
    'large',
    'body',
    'small',
    'micro',
    'button',
  ];
  const sample = 'Travel, rewritten in warm ink.';
  return (
    <div style={{ padding: 48, background: '#F2E8D5', minHeight: '100vh', color: '#2A1E18' }}>
      <h1
        style={{
          fontFamily: 'GT Sectra, Georgia, serif',
          fontSize: 49,
          letterSpacing: '-0.025em',
          margin: 0,
        }}
      >
        Typography
      </h1>
      <p
        style={{
          fontFamily: 'Söhne, system-ui, sans-serif',
          fontSize: 16,
          color: '#4A352A',
          marginTop: 8,
        }}
      >
        Two-family Warm Italian system. Display serif (GT Sectra fallback Georgia); UI sans (Söhne
        fallback system).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 48 }}>
        {order.map((name) => {
          const t = textStyle[name];
          return (
            <div key={name}>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 11,
                  color: '#4A352A',
                  marginBottom: 8,
                }}
              >
                {name} · {t.size}px · lh {t.lineHeight} · ls {t.letterSpacing}em · w{t.weight}
              </div>
              <div
                style={{
                  fontFamily: t.family,
                  fontSize: t.size,
                  lineHeight: t.lineHeight,
                  letterSpacing: `${t.letterSpacing}em`,
                  fontWeight: t.weight,
                }}
              >
                {sample}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const meta: Meta<typeof TypographyShowcase> = {
  title: 'Motion / Typography',
  component: TypographyShowcase,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof TypographyShowcase>;
export const TwoFamily: Story = {};
