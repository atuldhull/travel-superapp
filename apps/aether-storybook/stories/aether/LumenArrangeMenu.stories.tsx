/**
 * LumenArrangeMenu story (AE435) — Chromatic baseline for the AE410
 * Lumen-layout strategy picker. Storybook is isolated from apps/web
 * so the visuals are re-implemented inline; each variant pins one of
 * the five strategies as the active pill so the comparison snapshots
 * are deterministic.
 */
import type { Meta, StoryObj } from '@storybook/react';

type Strategy = 'time' | 'grid' | 'spiral' | 'wall' | 'mood';

const STRATEGIES: ReadonlyArray<{ id: Strategy; label: string; stub: boolean }> = [
  { id: 'time', label: 'Cloud', stub: false },
  { id: 'grid', label: 'Grid', stub: false },
  { id: 'spiral', label: 'Spiral', stub: false },
  { id: 'wall', label: 'Wall', stub: false },
  { id: 'mood', label: 'Mood', stub: true },
];

interface ArrangeMenuProps {
  readonly active: Strategy;
}

function LumenArrangeMenu({ active }: ArrangeMenuProps): React.ReactElement {
  return (
    <nav
      style={{
        display: 'flex',
        gap: 6,
        padding: '6px 8px',
        borderRadius: 999,
        background: 'rgba(26, 15, 9, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(232, 183, 119, 0.55)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: '#F2E8D5',
      }}
      aria-label="Lumen layout strategies"
    >
      {STRATEGIES.map((s) => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={isActive}
            style={{
              padding: '5px 11px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? '#C2614A' : 'transparent',
              color: isActive ? '#1A0F09' : '#F2E8D5',
              fontSize: 11,
              fontFamily: 'inherit',
              letterSpacing: 'inherit',
            }}
          >
            {s.label}
            {s.stub ? ' (AI)' : ''}
          </button>
        );
      })}
    </nav>
  );
}

const meta: Meta<typeof LumenArrangeMenu> = {
  title: 'Aether / LumenArrangeMenu',
  component: LumenArrangeMenu,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof LumenArrangeMenu>;

export const Time: Story = { args: { active: 'time' } };
export const Grid: Story = { args: { active: 'grid' } };
export const Spiral: Story = { args: { active: 'spiral' } };
export const Wall: Story = { args: { active: 'wall' } };
export const Mood: Story = { args: { active: 'mood' } };
