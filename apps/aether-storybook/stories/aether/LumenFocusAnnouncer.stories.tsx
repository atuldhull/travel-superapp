/**
 * LumenFocusAnnouncer story (AE463) — Chromatic baseline for the AE403
 * aria-live overlay. The real component is visually-hidden (clip:rect),
 * which would make Chromatic diffs useless, so the story renders a
 * VISIBLE wrapper around the announcer text alongside a small
 * sr-only-style swatch so reviewers can confirm both the text content
 * and the structural attributes. Each variant pins one of the focus
 * positions (none / first / middle / last) the underlying
 * `lumenFocusAnnouncement` helper emits.
 */
import type { Meta, StoryObj } from '@storybook/react';

interface AnnouncerProps {
  readonly text: string;
  readonly focusedId: string | null;
  readonly total: number;
}

function LumenFocusAnnouncer({ text, focusedId, total }: AnnouncerProps): React.ReactElement {
  return (
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        letterSpacing: '0.04em',
        color: '#F2E8D5',
        background: '#1A0F09',
        border: '1px solid rgba(232, 183, 119, 0.45)',
        borderRadius: 8,
        padding: '14px 18px',
        minWidth: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={{ color: '#E8B777', fontSize: 10 }}>role=status · aria-live=polite</span>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-aether-lumen-focus-announcer
        data-aether-focused-id={focusedId ?? ''}
        data-aether-total={total}
        style={{ color: '#F2E8D5' }}
      >
        {text}
      </span>
    </div>
  );
}

const meta: Meta<typeof LumenFocusAnnouncer> = {
  title: 'Aether / LumenFocusAnnouncer',
  component: LumenFocusAnnouncer,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof LumenFocusAnnouncer>;

const TOTAL = 5;

export const NoFocus: Story = {
  args: { text: 'Cloud overview', focusedId: null, total: TOTAL },
};

export const FocusFirst: Story = {
  args: { text: `Photo 1 of ${TOTAL}`, focusedId: 'asset_001', total: TOTAL },
};

export const FocusMid: Story = {
  args: { text: `Photo 3 of ${TOTAL}`, focusedId: 'asset_003', total: TOTAL },
};

export const FocusLast: Story = {
  args: { text: `Photo ${TOTAL} of ${TOTAL}`, focusedId: 'asset_005', total: TOTAL },
};
