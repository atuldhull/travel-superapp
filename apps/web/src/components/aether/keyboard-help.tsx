'use client';

/**
 * <KeyboardHelp> — small modal listing the keyboard shortcuts that
 * power Aether (AE97). Triggered by pressing `?` anywhere on an
 * Aether surface (skipped when focus is in an input/textarea/
 * contenteditable). Esc dismisses.
 *
 * Mounted by every shell next to <AetherA11yStyles/>. The list is
 * kept in this file so adding a shortcut means adding a row here
 * and the underlying handler.
 */
import { useEffect, useState } from 'react';
import { useTheme } from '@app/aether-core';

interface Shortcut {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
}

const SHORTCUTS: ReadonlyArray<Shortcut> = [
  { keys: ['⌘ K', '/'], label: 'Open Pulse · the AI drawer' },
  { keys: ['Esc'], label: 'Close Pulse · this overlay' },
  { keys: ['/<cmd>'], label: 'Slash commands inside Pulse' },
  { keys: ['?'], label: 'Open this shortcut overlay' },
];

export function KeyboardHelp(): React.ReactElement | null {
  const theme = useTheme();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        return;
      }
      // Open on '?' when not in a text input.
      if (e.key === '?' && !open) {
        const target = e.target as HTMLElement | null;
        if (target !== null) {
          const tag = target.tagName;
          const editable = target.isContentEditable === true;
          if (editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            return;
          }
        }
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const olive = theme.palette.olive;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 15, 11, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: (theme.layer.pulse ?? 60) + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: '100%',
          padding: theme.space.loose,
          borderRadius: theme.radius.lg,
          background: surface.base,
          border: `1px solid ${ink.whisper}`,
          boxShadow: '0 24px 64px rgba(24, 15, 11, 0.32)',
          fontFamily: theme.font.ui,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.space.comfy,
            marginBottom: theme.space.comfy,
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
            }}
          >
            Keyboard
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcut overlay"
            style={{
              background: 'transparent',
              border: 'none',
              color: ink.soft,
              fontSize: 18,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <h2
          style={{
            fontFamily: theme.font.display,
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: '-0.018em',
            fontWeight: 600,
            margin: 0,
            color: ink.base,
          }}
        >
          Aether shortcuts.
        </h2>
        <p
          style={{
            fontFamily: theme.font.display,
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.55,
            color: ink.soft,
            margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
          }}
        >
          Press <kbd style={kbdStyle(ink)}>?</kbd> any time to open this card. Esc closes.
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: theme.space.tight,
          }}
        >
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: theme.space.comfy,
                alignItems: 'center',
                padding: `${theme.space.tight}px 0`,
                borderBottom: `1px solid ${olive.whisper}`,
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map((k, i) => (
                  <kbd key={i} style={kbdStyle(ink)}>
                    {k}
                  </kbd>
                ))}
              </div>
              <span
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 15,
                  color: ink.base,
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

function kbdStyle(ink: { base: string; whisper: string }): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(24, 15, 11, 0.06)',
    border: `1px solid ${ink.whisper}`,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontSize: 11,
    fontWeight: 600,
    color: ink.base,
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  };
}
