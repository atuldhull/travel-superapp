'use client';

/**
 * AE391 — `<Phase1ContinuumReceiverToast>`.
 *
 * Closes the AE390 handoff loop the other way: when a device opens a
 * URL with the Continuum marker (`?aether-continuum=1`), this toast
 * surfaces a small "Continued from another device" affordance so the
 * receiver knows what just happened.
 *
 * Behaviour:
 *   • Auto-dismisses after `autoDismissMs` (default 4500ms — long
 *     enough to read, short enough not to nag).
 *   • Dismiss button closes immediately.
 *   • Stays dismissed for the rest of the page lifetime — re-opening
 *     the popover sender doesn't re-trigger.
 *   • SSR-safe: pure render returns null when the landing isn't a
 *     handoff or when the dismissed flag is set.
 *
 * Position: fixed bottom-center, anchored above the AE390 Continuum
 * bar (z-index 14 so it sits over the bar but below modal-like dialogs).
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { formatContinuumLandingMessage, type ContinuumLanding } from './continuum-landing';
import { useContinuumLanding } from './use-continuum-landing';

export interface Phase1ContinuumReceiverToastProps {
  /** Override the landing state. Tests + Storybook pin this; the live
   *  shell omits it to read from `useContinuumLanding()`. */
  readonly landing?: ContinuumLanding;
  /** Auto-dismiss delay in ms. Default 4500 (≈4.5 seconds). Set to 0
   *  or negative to disable auto-dismiss (manual close only). */
  readonly autoDismissMs?: number;
  /** Bottom offset above the Continuum bar (default 16px above bar+pad). */
  readonly bottomOffsetPx?: number;
  /** Hide entirely (e.g. surfaces that shouldn't show one). */
  readonly hidden?: boolean;
  /** Initial dismissed state — tests + Storybook can pin this. Default
   *  false (the toast appears on landing). */
  readonly initialDismissed?: boolean;
  /** AE394 — replace the default formatter output with surface-specific
   *  text. The Atlas shell uses this to inject the trip title (which
   *  the AE391 generic formatter couldn't know about). When undefined
   *  / null, falls back to `formatContinuumLandingMessage(extras)`. */
  readonly messageOverride?: string | null;
}

const DEFAULT_AUTO_DISMISS_MS = 4500;

export function Phase1ContinuumReceiverToast(
  props: Phase1ContinuumReceiverToastProps = {},
): React.ReactElement | null {
  if (props.hidden === true) return null;
  if (props.landing !== undefined) {
    return <Phase1ContinuumReceiverToastInner {...props} landing={props.landing} />;
  }
  return <Phase1ContinuumReceiverToastWithLanding {...props} />;
}

/** Wrapper that calls `useContinuumLanding()` — must sit beneath a Next
 *  navigation context (App Router pages do). */
function Phase1ContinuumReceiverToastWithLanding(
  props: Omit<Phase1ContinuumReceiverToastProps, 'landing'>,
): React.ReactElement | null {
  const landing = useContinuumLanding();
  return <Phase1ContinuumReceiverToastInner {...props} landing={landing} />;
}

/** Inner — receives the resolved landing as a prop so the outer wrapper
 *  can decide whether to call the hook (rules-of-hooks-safe). */
function Phase1ContinuumReceiverToastInner({
  landing,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
  bottomOffsetPx = 36,
  initialDismissed = false,
  messageOverride,
}: Phase1ContinuumReceiverToastProps & { landing: ContinuumLanding }): React.ReactElement | null {
  const [dismissed, setDismissed] = useState<boolean>(initialDismissed);

  // Auto-dismiss timer — clears on unmount + when the landing changes
  // so navigation away cancels a still-pending dismiss.
  useEffect(() => {
    if (!landing.isHandoff || dismissed) return undefined;
    if (autoDismissMs <= 0) return undefined;
    const id = window.setTimeout(() => setDismissed(true), autoDismissMs);
    return (): void => {
      window.clearTimeout(id);
    };
  }, [landing.isHandoff, dismissed, autoDismissMs]);

  const onDismiss = useCallback(() => setDismissed(true), []);

  if (!landing.isHandoff || dismissed) return null;
  const message =
    messageOverride !== undefined && messageOverride !== null && messageOverride !== ''
      ? messageOverride
      : formatContinuumLandingMessage(landing.extras);

  const containerStyle: CSSProperties = {
    position: 'fixed',
    bottom: bottomOffsetPx,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 14,
    minWidth: 240,
    maxWidth: 420,
    padding: '10px 14px',
    borderRadius: 999,
    background: 'var(--aether-palette-ink, #1A0F09)',
    color: 'var(--aether-palette-surface, #F2E8D5)',
    border: '1px solid var(--aether-palette-glow, #E8B777)',
    boxShadow: '0 14px 40px rgba(0, 0, 0, 0.45)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-aether-continuum-receiver-toast
      style={containerStyle}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--aether-palette-accent, #C2614A)',
          boxShadow: '0 0 8px var(--aether-palette-accent, #C2614A)',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        data-aether-continuum-receiver-dismiss
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 2,
          opacity: 0.8,
        }}
      >
        ×
      </button>
    </div>
  );
}
