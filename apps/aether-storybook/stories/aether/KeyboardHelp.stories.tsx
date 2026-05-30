/**
 * KeyboardHelp story (AE135) — Chromatic baseline for the editorial
 * `?`-key overlay that mounts on every Aether shell (AE97). The real
 * component lives in apps/web and gates open/close behind a window
 * keydown listener; this story renders the open state directly so
 * design + a11y can review the modal without keypress wiring.
 */
import type { Meta, StoryObj } from '@storybook/react';

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  inkWhisper: '#D6CBB0',
  terracottaDeep: '#9A4836',
  oliveWhisper: '#D9DCC8',
};

interface ShortcutRow {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
}

const SHORTCUTS: ReadonlyArray<ShortcutRow> = [
  { keys: ['⌘ K', '/'], label: 'Open Pulse · the AI drawer' },
  { keys: ['Esc'], label: 'Close Pulse · this overlay' },
  { keys: ['/<cmd>'], label: 'Slash commands inside Pulse' },
  { keys: ['?'], label: 'Open this shortcut overlay' },
];

function Kbd({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        background: 'rgba(24, 15, 11, 0.06)',
        border: `1px solid ${COL.inkWhisper}`,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11,
        fontWeight: 600,
        color: COL.ink,
        letterSpacing: '0.04em',
        lineHeight: 1.4,
      }}
    >
      {children}
    </kbd>
  );
}

function HelpModal(): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 15, 11, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          padding: 24,
          borderRadius: 12,
          background: COL.cream,
          border: `1px solid ${COL.inkWhisper}`,
          boxShadow: '0 24px 64px rgba(24, 15, 11, 0.32)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: COL.terracottaDeep,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Keyboard
          </p>
          <span aria-hidden style={{ color: COL.inkSoft, fontSize: 18 }}>
            ×
          </span>
        </div>
        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: '-0.018em',
            fontWeight: 600,
            margin: 0,
            color: COL.ink,
          }}
        >
          Aether shortcuts.
        </h2>
        <p
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.55,
            color: COL.inkSoft,
            margin: '6px 0 16px',
          }}
        >
          Press <Kbd>?</Kbd> any time to open this card. Esc closes.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 16,
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: `1px solid ${COL.oliveWhisper}`,
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </div>
              <span
                style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 15,
                  color: COL.ink,
                  lineHeight: 1.4,
                }}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const meta: Meta<typeof HelpModal> = {
  title: 'Aether / KeyboardHelp',
  component: HelpModal,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof HelpModal>;
export const Open: Story = {};
