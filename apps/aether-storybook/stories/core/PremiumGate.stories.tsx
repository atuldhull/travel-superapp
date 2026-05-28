/**
 * PremiumGate stories — locked/unlocked across the four tiers.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { PremiumGate, PremiumProvider, type PremiumTier } from '@app/aether-core';

interface DemoProps {
  tier: PremiumTier;
}

function GateDemo({ tier }: DemoProps): React.ReactElement {
  return (
    <PremiumProvider tier={tier}>
      <div style={{ padding: 48, background: '#F2E8D5', minHeight: '100vh', color: '#2A1E18' }}>
        <h1
          style={{
            fontFamily: 'GT Sectra, Georgia, serif',
            fontSize: 31,
            margin: 0,
            letterSpacing: '-0.015em',
          }}
        >
          Premium gating — tier: {String(tier)}
        </h1>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginTop: 32 }}
        >
          {(['genie-camera', 'predictor-auto', 'compass-eye', 'lumen-pdf'] as const).map((cap) => (
            <PremiumGate
              key={cap}
              cap={cap}
              fallback={
                <div
                  style={{
                    padding: 24,
                    borderRadius: 14,
                    border: '1px dashed rgba(42, 30, 24, 0.2)',
                    background: 'rgba(194, 97, 74, 0.08)',
                    fontFamily: 'Söhne, system-ui, sans-serif',
                  }}
                >
                  <strong>{cap}</strong> — locked. Upgrade to unlock.
                </div>
              }
            >
              <div
                style={{
                  padding: 24,
                  borderRadius: 14,
                  background: '#C2614A',
                  color: '#F2E8D5',
                  fontFamily: 'Söhne, system-ui, sans-serif',
                }}
              >
                <strong>{cap}</strong> — unlocked ✓
              </div>
            </PremiumGate>
          ))}
        </div>
      </div>
    </PremiumProvider>
  );
}

const meta: Meta<typeof GateDemo> = {
  title: 'Core / PremiumGate',
  component: GateDemo,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof GateDemo>;

export const Anonymous: Story = { args: { tier: null } };
export const Free: Story = { args: { tier: 'free' } };
export const Plus: Story = { args: { tier: 'plus' } };
export const Pro: Story = { args: { tier: 'pro' } };
