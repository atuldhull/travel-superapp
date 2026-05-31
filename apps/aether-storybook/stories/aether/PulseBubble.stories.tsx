/**
 * AE372 — Chromatic baseline for the AE345 `pulseMessageBubbleStyle`
 * helper. Two bubbles side-by-side (user vs assistant) so a future
 * accent / typography change has a visual lock to regression-test
 * against.
 */
import type { Meta, StoryObj } from '@storybook/react';
import {
  pulseMessageBubbleStyle,
  type ChatRole,
} from '../../../../apps/web/src/components/aether/pulse/pulse-bubble-style';

const theme = {
  color: {
    surface: { base: '#F2E8D5' },
    ink: { base: '#180F0B', whisper: '#CFC4B3' },
  },
  palette: {
    terracotta: { base: '#C2614A' },
  },
  font: {
    ui: 'Inter, system-ui, sans-serif',
    display: 'Playfair Display, Georgia, serif',
  },
  text: {
    small: { size: 13 },
  },
};

interface BubbleStripProps {
  readonly user: string;
  readonly assistant: string;
}

function Bubble({ role, content }: { role: ChatRole; content: string }): React.ReactElement {
  return (
    <div
      style={{
        ...pulseMessageBubbleStyle(role, theme),
        maxWidth: '88%',
        padding: '10px 14px',
        borderRadius: 16,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </div>
  );
}

function BubbleStrip({ user, assistant }: BubbleStripProps): React.ReactElement {
  return (
    <div
      style={{
        background: '#1A0F09',
        padding: 48,
        minHeight: '100vh',
        fontFamily: theme.font.ui,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 480,
          background: theme.color.surface.base,
          padding: 24,
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Bubble role="user" content={user} />
        <Bubble role="assistant" content={assistant} />
      </div>
    </div>
  );
}

const meta: Meta<typeof BubbleStrip> = {
  title: 'Aether / PulseBubble',
  component: BubbleStrip,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof BubbleStrip>;

export const FreshTurn: Story = {
  args: {
    user: 'Plan a slow week in Ladakh — cheap, art, no driving.',
    assistant: 'Got it. Five days in Leh + two in Nubra, hostels only, art districts day 2.',
  },
};

export const LongTurn: Story = {
  args: {
    user: 'Make it cheaper. Drop the Nubra leg and keep Leh, but add a half-day workshop with a local thangka painter if there is one in town.',
    assistant:
      'Trimmed to four days in Leh, hostels + dhaba breakfasts. Day 2 morning held for a thangka workshop at the Central Asian Museum atelier; you can walk-in any morning.',
  },
};

export const ShortTurn: Story = {
  args: {
    user: 'two more days?',
    assistant: 'Yes — added a Pangong overnight + a quiet Stok rest day.',
  },
};
