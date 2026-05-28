'use client';

/**
 * <AudioChip> — Aether audio engine status pill + settings popover.
 *
 * Lives in DriftNav. Click → popover with:
 *   • Volume slider (-60dB → 0dB, persisted to localStorage)
 *   • Mute toggle (sets engine to forceSilent until un-muted)
 *   • Test chime button (engine.pluck(2))
 *   • Brief about line + activation CTA when not yet started
 *
 * The chip itself shows engine state at a glance:
 *   • awaiting-activation → cream pill with breathing terracotta dot
 *   • starting → italic 'Loading…'
 *   • running → cream pill with olive-green dot
 *   • silent → 🔇 emoji
 *   • failed → '!' with title tooltip
 *
 * Settings persist via localStorage so the user's choice survives
 * reloads — `aether-audio-volume` (number, dB) and `aether-audio-muted`
 * (bool string).
 */
import { useEffect, useRef, useState } from 'react';
import { useAudioEngine, useMotionPolicy, useTheme } from '@app/aether-core';

interface AudioChipProps {
  /** Pass-through to control dark-on-photo vs ink-on-cream colouring. */
  readonly inverted?: boolean;
}

const STORAGE_VOLUME = 'aether-audio-volume';
const STORAGE_MUTED = 'aether-audio-muted';

function readStoredVolume(): number {
  if (typeof window === 'undefined') return -6;
  const raw = window.localStorage.getItem(STORAGE_VOLUME);
  if (raw === null) return -6;
  const n = Number(raw);
  if (!Number.isFinite(n)) return -6;
  return Math.max(-60, Math.min(0, n));
}

function readStoredMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_MUTED) === '1';
}

export function AudioChip({ inverted = false }: AudioChipProps): React.ReactElement | null {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { engine, status } = useAudioEngine();
  const [open, setOpen] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(-6);
  const [muted, setMuted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hydrate persisted values once.
  useEffect(() => {
    setVolume(readStoredVolume());
    setMuted(readStoredMuted());
  }, []);

  // Push volume changes through to the engine.
  useEffect(() => {
    if (status === 'running') {
      engine.setMasterDb(muted ? -60 : volume);
    }
  }, [engine, status, volume, muted]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const olive = theme.palette.olive;

  // When motion is none, audio is also stripped — nothing meaningful to render.
  if (motionPolicy === 'none' && status !== 'failed') return null;

  const persistVolume = (v: number): void => {
    setVolume(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_VOLUME, String(v));
    }
  };

  const persistMuted = (m: boolean): void => {
    setMuted(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_MUTED, m ? '1' : '0');
    }
    if (status === 'running') {
      engine.setMasterDb(m ? -60 : volume);
    }
  };

  const handleActivateClick = (): void => {
    void engine.activate().then(() => {
      engine.setMasterDb(muted ? -60 : volume);
      if (!muted) engine.startAmbient();
    });
  };

  const handleTestPluck = (): void => engine.pluck(2);

  // Render the chip in compact form (status-only) when status is silent/failed/starting.
  if (status === 'silent') {
    return (
      <span
        title="Audio is muted (system-level or your opt-out)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: 14,
          color: inverted ? surface.soft : ink.soft,
          opacity: 0.6,
          padding: '4px 6px',
        }}
      >
        🔇
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        title="Audio engine couldn't start. Browser autoplay policy or a CDN miss — your visit is still fine."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: theme.radius.pill,
          background: 'transparent',
          color: inverted ? surface.soft : ink.soft,
          fontFamily: theme.font.ui,
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        <span aria-hidden>!</span>
        <span>Audio</span>
      </span>
    );
  }

  if (status === 'starting') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderRadius: theme.radius.pill,
          background: 'transparent',
          color: inverted ? surface.soft : ink.soft,
          fontFamily: theme.font.display,
          fontSize: 11,
          fontStyle: 'italic',
          opacity: 0.78,
        }}
      >
        Loading…
      </span>
    );
  }

  const isAwaiting = status === 'awaiting-activation';
  const dotColor = isAwaiting ? accent.glow : '#5A8F3A';
  const label = isAwaiting ? 'Audio off' : 'Audio on';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={isAwaiting ? 'Audio settings' : 'Audio settings + test'}
        aria-label="Audio settings"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: theme.radius.pill,
          background: inverted ? 'rgba(242, 232, 213, 0.10)' : olive.whisper,
          border: inverted ? `1px solid rgba(242, 232, 213, 0.20)` : `1px solid ${ink.whisper}`,
          color: inverted ? surface.base : ink.base,
          fontFamily: theme.font.ui,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 220ms, border-color 220ms',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            animation:
              motionPolicy === 'full' && isAwaiting
                ? 'aether-audio-chip-pulse 2s ease-in-out infinite'
                : 'none',
          }}
        />
        <span>{label}</span>
        <style>{`
          @keyframes aether-audio-chip-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50%      { transform: scale(1.5); opacity: 0.5; }
          }
        `}</style>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Audio settings"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: theme.layer.overlay,
            width: 260,
            padding: theme.space.comfy,
            borderRadius: theme.radius.lg,
            background: 'rgba(242, 232, 213, 0.97)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${ink.whisper}`,
            boxShadow: '0 16px 48px rgba(24, 15, 11, 0.22), 0 2px 8px rgba(24, 15, 11, 0.12)',
            color: ink.base,
            fontFamily: theme.font.ui,
            animation:
              motionPolicy === 'full'
                ? 'aether-audio-pop-open 200ms cubic-bezier(0.16, 0.84, 0.32, 1)'
                : 'none',
          }}
        >
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            Audio
          </p>

          {isAwaiting && (
            <button
              type="button"
              onClick={handleActivateClick}
              style={{
                width: '100%',
                padding: `${theme.space.tight}px ${theme.space.inline}px`,
                borderRadius: theme.radius.pill,
                background: accent.base,
                color: surface.base,
                border: 'none',
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: theme.space.comfy,
              }}
            >
              ▸ Enable ambient pad
            </button>
          )}

          {/* Volume */}
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: theme.space.tight,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: theme.font.ui,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: ink.soft,
                fontWeight: 600,
              }}
            >
              <span>Volume</span>
              <span style={{ fontFamily: theme.font.mono, letterSpacing: '0.08em' }}>
                {muted ? 'mute' : `${volume.toFixed(0)}dB`}
              </span>
            </div>
            <input
              type="range"
              min={-60}
              max={0}
              step={1}
              value={volume}
              onChange={(e) => persistVolume(Number(e.target.value))}
              disabled={muted}
              aria-label="Audio volume in dB"
              style={{
                width: '100%',
                accentColor: accent.base,
                opacity: muted ? 0.5 : 1,
                cursor: muted ? 'not-allowed' : 'pointer',
              }}
            />
          </label>

          {/* Mute toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.tight,
              padding: `${theme.space.hairline}px 0`,
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              color: ink.base,
              cursor: 'pointer',
              marginBottom: theme.space.tight,
            }}
          >
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => persistMuted(e.target.checked)}
              style={{ accentColor: accent.base }}
            />
            <span>Mute Aether audio</span>
          </label>

          {/* Test pluck */}
          {!isAwaiting && (
            <button
              type="button"
              onClick={handleTestPluck}
              disabled={muted}
              style={{
                width: '100%',
                padding: `${theme.space.hairline}px ${theme.space.inline}px`,
                borderRadius: theme.radius.pill,
                background: 'transparent',
                border: `1px solid ${ink.whisper}`,
                color: ink.base,
                fontFamily: theme.font.ui,
                fontSize: theme.text.small.size,
                fontWeight: 600,
                cursor: muted ? 'not-allowed' : 'pointer',
                opacity: muted ? 0.5 : 1,
                marginBottom: theme.space.tight,
              }}
            >
              Test chime
            </button>
          )}

          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 12,
              lineHeight: 1.45,
              color: ink.soft,
              margin: 0,
              marginTop: theme.space.tight,
              paddingTop: theme.space.tight,
              borderTop: `1px solid ${olive.whisper}`,
            }}
          >
            Nylon-string + tape-warm pad, in D minor. Composer-recorded samples land Phase 2.
          </p>

          <style>{`
            @keyframes aether-audio-pop-open {
              from { opacity: 0; transform: translateY(-4px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
