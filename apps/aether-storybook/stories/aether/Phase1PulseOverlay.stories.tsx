/**
 * Phase1PulseOverlay story (AE463) — Chromatic baseline for the
 * always-on corner glow that hosts the Pulse Phase 1 scene. Storybook
 * is isolated from apps/web and from R3F, so the visuals are
 * re-implemented inline as a static 64px circle with mood-tinted
 * concentric rings + corner placement chrome. Each variant pins a
 * representative (corner, mood) pair so reviewers can verify both the
 * placement and the breathing palette without exercising the actual
 * rAF loop.
 */
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

type PulseMood = 'idle' | 'listening' | 'speaking' | 'sleeping';
type Corner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const CORNER_STYLES: Record<Corner, CSSProperties> = {
  'bottom-right': { right: 24, bottom: 24 },
  'bottom-left': { left: 24, bottom: 24 },
  'top-right': { right: 24, top: 24 },
  'top-left': { left: 24, top: 24 },
};

const MOOD_GLOW: Record<PulseMood, { core: string; ring: string; halo: string }> = {
  idle: { core: '#E8B777', ring: '#C2614A', halo: 'rgba(232, 183, 119, 0.55)' },
  listening: { core: '#F4D9A8', ring: '#E8B777', halo: 'rgba(244, 217, 168, 0.75)' },
  speaking: { core: '#FFEAC8', ring: '#C2614A', halo: 'rgba(255, 234, 200, 0.85)' },
  sleeping: { core: '#7A5436', ring: '#3A2418', halo: 'rgba(122, 84, 54, 0.35)' },
};

const SIZE_PX = 64;

interface OverlayProps {
  readonly corner: Corner;
  readonly mood: PulseMood;
  readonly label: string;
}

function Phase1PulseOverlay({ corner, mood, label }: OverlayProps): React.ReactElement {
  const palette = MOOD_GLOW[mood];
  // Stage frame so the corner placement is legible in the snapshot.
  const stageStyle: CSSProperties = {
    position: 'relative',
    width: 320,
    height: 240,
    background: 'linear-gradient(135deg, #2A1810 0%, #1A0F09 100%)',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(232, 183, 119, 0.18)',
  };
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    width: SIZE_PX,
    height: SIZE_PX,
    borderRadius: '50%',
    background: `radial-gradient(circle at 50% 50%, ${palette.core} 0%, ${palette.ring} 55%, transparent 80%)`,
    boxShadow: `0 0 24px ${palette.halo}, 0 0 8px ${palette.halo}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...CORNER_STYLES[corner],
  };
  const coreStyle: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: palette.core,
    boxShadow: `0 0 12px ${palette.halo}`,
  };
  return (
    <div style={stageStyle}>
      <div
        role="button"
        aria-label={label}
        data-aether-pulse-overlay
        data-aether-pulse-corner={corner}
        data-aether-pulse-mood={mood}
        style={overlayStyle}
      >
        <div style={coreStyle} />
      </div>
    </div>
  );
}

const meta: Meta<typeof Phase1PulseOverlay> = {
  title: 'Aether / Phase1PulseOverlay',
  component: Phase1PulseOverlay,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Phase1PulseOverlay>;

const LABEL = 'Aether Pulse — always-on AI';

export const BottomRightIdle: Story = {
  args: { corner: 'bottom-right', mood: 'idle', label: LABEL },
};

export const BottomRightListening: Story = {
  args: { corner: 'bottom-right', mood: 'listening', label: LABEL },
};

export const BottomLeftIdle: Story = {
  args: { corner: 'bottom-left', mood: 'idle', label: LABEL },
};

export const TopRightSpeaking: Story = {
  args: { corner: 'top-right', mood: 'speaking', label: LABEL },
};

export const TopLeftSleeping: Story = {
  args: { corner: 'top-left', mood: 'sleeping', label: LABEL },
};
