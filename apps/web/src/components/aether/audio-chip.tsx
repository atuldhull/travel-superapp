'use client';

/**
 * <AudioChip> — Aether audio engine status pill.
 *
 * Lives in DriftNav so audio state is consistently inspectable across
 * every Aether surface. Different state per engine status:
 *   • awaiting-activation: cream pill with breathing dot, click activates +
 *     starts ambient pad (browser autoplay policy: needs a user gesture)
 *   • starting: 'Loading…' italic
 *   • running: cream pill with green dot, click plays a single pluck
 *     (test affordance — operator can confirm audio is reaching speakers)
 *   • silent: 🔇 — user opted out, no interaction
 *   • failed: subtle '!' with title tooltip explaining
 *
 * The big '◔ audio' chip in the Drift hero stays — it's the primary
 * affordance for first-time activation. AudioChip is the persistent
 * state indicator.
 */
import { useAudioEngine, useMotionPolicy, useTheme } from '@app/aether-core';

interface AudioChipProps {
  /** Pass-through to control dark-on-photo vs ink-on-cream colouring. */
  readonly inverted?: boolean;
}

export function AudioChip({ inverted = false }: AudioChipProps): React.ReactElement | null {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const { engine, status } = useAudioEngine();

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const olive = theme.palette.olive;

  // When motion is none, audio is also stripped — nothing meaningful
  // to render.
  if (motionPolicy === 'none' && status !== 'failed') return null;

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
  const dotColor = isAwaiting ? accent.glow : '#5A8F3A'; // olive-green for running
  const label = isAwaiting ? 'Audio off' : 'Audio on';
  const titleAttr = isAwaiting
    ? 'Click to enable the ambient pad + nylon-pluck confirms.'
    : 'Audio engine running. Click for a test pluck.';

  const handleClick = (): void => {
    if (isAwaiting) {
      void engine.activate().then(() => engine.startAmbient());
    } else {
      // Running — play a single pluck as a verification chime.
      engine.pluck(2);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={titleAttr}
      aria-label={titleAttr}
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
  );
}
