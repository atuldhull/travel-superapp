/**
 * GenieCaptureModeToggle story (AE438) — Chromatic baseline for the
 * AE413 voice / camera mode pill row inside the Genie modal. Two
 * variants pin each mode active; one extra variant shows the disabled
 * state used when getUserMedia is denied.
 */
import type { Meta, StoryObj } from '@storybook/react';

type Mode = 'voice' | 'camera';

const MODES: ReadonlyArray<{ id: Mode; label: string; glyph: string }> = [
  { id: 'voice', label: 'Voice', glyph: '🎤' },
  { id: 'camera', label: 'Camera', glyph: '📷' },
];

interface ToggleProps {
  readonly active: Mode;
  readonly disabled: boolean;
}

function GenieCaptureModeToggle({ active, disabled }: ToggleProps): React.ReactElement {
  return (
    <div
      role="group"
      aria-label="Genie capture mode"
      style={{
        display: 'flex',
        gap: 4,
        padding: 6,
        borderRadius: 999,
        background: 'rgba(26, 15, 9, 0.85)',
        border: '1px solid rgba(232, 183, 119, 0.45)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#F2E8D5',
      }}
    >
      {MODES.map((m) => {
        const isActive = m.id === active;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: isActive ? '#C2614A' : 'transparent',
              color: isActive ? '#1A0F09' : '#F2E8D5',
              fontSize: 13,
              letterSpacing: '0.04em',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>
              {m.glyph}
            </span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const meta: Meta<typeof GenieCaptureModeToggle> = {
  title: 'Aether / GenieCaptureModeToggle',
  component: GenieCaptureModeToggle,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof GenieCaptureModeToggle>;

export const VoiceActive: Story = { args: { active: 'voice', disabled: false } };
export const CameraActive: Story = { args: { active: 'camera', disabled: false } };
export const Disabled: Story = { args: { active: 'voice', disabled: true } };
