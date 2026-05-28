'use client';

/**
 * <Pulse> — always-present AI overlay on every Aether surface.
 *
 * A small terracotta FAB sits bottom-right. Click expands it into a
 * glass-cream drawer with three quick prompts (Plan a trip / Find a
 * destination / Ask about a place) + a free-form input. Submitting
 * an input lands on /aether/plan with the question prefilled (Phase 0
 * stub — Phase 1 wires this to the ai-service /chat endpoint live in
 * the surface).
 *
 * Mounted by every Aether *-shell via the AppChrome bare path. Hidden
 * on `/aether/plan` itself (the planner IS the AI surface there).
 *
 * Honors motion policy — closed→open is a spring; reduced renders the
 * drawer flat.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMotionPolicy, useTheme } from '@app/aether-core';
import { useViewport } from '../use-viewport';

const QUICK_PROMPTS = [
  { label: 'Plan a trip', kind: 'plan' as const, href: '/aether/plan' },
  { label: 'Find a destination', kind: 'find' as const, href: '/aether/destinations' },
  { label: 'See the map', kind: 'map' as const, href: '/aether/atlas' },
];

export function Pulse(): React.ReactElement | null {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { isNarrow } = useViewport();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [q, setQ] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide Pulse on /aether/plan — that's already the AI surface.
  const hidden = pathname === '/aether/plan';

  // Auto-focus the input when the drawer opens (motion-respecting).
  useEffect(() => {
    if (open && inputRef.current !== null) {
      // Slight delay so the spring settles before focus.
      const id = window.setTimeout(
        () => inputRef.current?.focus(),
        motionPolicy === 'full' ? 200 : 0,
      );
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, motionPolicy]);

  // Close on Escape + click-outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (hidden) return null;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed === '') {
      router.push('/aether/plan');
      return;
    }
    // Hand the freeform question to the planner. Phase 1 wires this to
    // a real conversational AI endpoint.
    router.push(`/aether/plan?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: isNarrow ? theme.space.comfy : theme.space.gutter,
        right: isNarrow ? theme.space.comfy : theme.space.gutter,
        zIndex: theme.layer.pulse,
        fontFamily: theme.font.ui,
      }}
    >
      {/* Drawer panel (only when open) */}
      {open && (
        <div
          role="dialog"
          aria-label="Aether assistant"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 64,
            width: 'min(360px, calc(100vw - 32px))',
            padding: theme.space.loose,
            borderRadius: theme.radius.lg,
            background: 'rgba(242, 232, 213, 0.96)',
            backdropFilter: 'blur(16px) saturate(160%)',
            WebkitBackdropFilter: 'blur(16px) saturate(160%)',
            border: `1px solid ${ink.whisper}`,
            boxShadow: '0 24px 64px rgba(24, 15, 11, 0.28), 0 4px 12px rgba(24, 15, 11, 0.12)',
            color: ink.base,
            transformOrigin: 'bottom right',
            animation:
              motionPolicy === 'full'
                ? 'aether-pulse-open 280ms cubic-bezier(0.16, 0.84, 0.32, 1)'
                : 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.space.tight,
            }}
          >
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: accent.deep,
                fontWeight: 600,
              }}
            >
              Pulse · ask anything
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              style={{
                width: 24,
                height: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.pill,
                background: 'transparent',
                border: 'none',
                color: ink.soft,
                fontSize: 16,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <p
            style={{
              fontFamily: theme.font.display,
              fontSize: 17,
              lineHeight: 1.45,
              letterSpacing: '-0.008em',
              color: ink.base,
              margin: 0,
              marginBottom: theme.space.comfy,
            }}
          >
            How can the journey help today?
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: theme.space.tight, marginBottom: theme.space.comfy }}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="A place, a date, a feeling…"
              aria-label="Ask the assistant"
              style={{
                flex: 1,
                padding: `${theme.space.tight}px ${theme.space.inline}px`,
                borderRadius: theme.radius.pill,
                border: `1px solid ${ink.whisper}`,
                background: surface.base,
                color: ink.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.body.size,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              aria-label="Ask"
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                border: 'none',
                fontSize: 16,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              →
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: theme.font.ui,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: ink.soft,
                opacity: 0.7,
                marginBottom: 4,
              }}
            >
              Or quick paths
            </span>
            {QUICK_PROMPTS.map((p) => (
              <Link
                key={p.kind}
                href={p.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${theme.space.tight}px ${theme.space.inline}px`,
                  borderRadius: theme.radius.md,
                  background: 'transparent',
                  textDecoration: 'none',
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.body.size,
                  border: `1px solid transparent`,
                  transition: 'background 220ms, border-color 220ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = olive.whisper;
                  e.currentTarget.style.borderColor = olive.whisper;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onClick={() => setOpen(false)}
              >
                <span>{p.label}</span>
                <span aria-hidden style={{ color: accent.deep, fontWeight: 600 }}>
                  →
                </span>
              </Link>
            ))}
          </div>

          <div
            style={{
              marginTop: theme.space.comfy,
              paddingTop: theme.space.tight,
              borderTop: `1px solid ${olive.whisper}`,
              fontFamily: theme.font.mono,
              fontSize: 10,
              color: ink.soft,
              opacity: 0.55,
              letterSpacing: '0.12em',
            }}
          >
            Pulse · Phase 0 · live AI lands Phase 1
          </div>
        </div>
      )}

      {/* The FAB itself */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open Aether assistant'}
        aria-expanded={open}
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.pill,
          background: accent.base,
          color: surface.base,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(194, 97, 74, 0.45), 0 2px 6px rgba(24, 15, 11, 0.18)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.font.display,
          fontSize: 22,
          fontWeight: 600,
          transition: 'transform 240ms cubic-bezier(0.42, 0, 0.18, 1), box-shadow 240ms',
        }}
        onMouseEnter={(e) => {
          if (motionPolicy === 'full') {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)';
            e.currentTarget.style.boxShadow =
              '0 12px 32px rgba(194, 97, 74, 0.55), 0 4px 10px rgba(24, 15, 11, 0.22)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow =
            '0 8px 24px rgba(194, 97, 74, 0.45), 0 2px 6px rgba(24, 15, 11, 0.18)';
        }}
      >
        {open ? '×' : '✦'}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: ochre.glow,
            border: `2px solid ${surface.base}`,
            display: open ? 'none' : 'block',
            // Subtle pulse to draw the eye on first paint.
            animation:
              motionPolicy === 'full' ? 'aether-pulse-dot 2.4s ease-in-out infinite' : 'none',
          }}
        />
      </button>

      <style>{`
        @keyframes aether-pulse-open {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aether-pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.4); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}
