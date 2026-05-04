/**
 * V.UX.13 + V.UX.35 — persistent SOS FAB with hold-to-confirm.
 *
 *   - Hold the red breathing pill for 3 seconds → trigger fires.
 *     A radial conic-gradient fills as time elapses; releasing
 *     early aborts.
 *   - Anonymous viewers get a disabled state with a tooltip.
 *   - On success the active-SOS state lands in `lib/active-sos.ts`
 *     so `<ActiveSosBanner>` (mounted in layout.tsx) can render the
 *     sticky "I'm OK" cancel + local-emergency panel without a
 *     server round-trip on every page.
 *
 * Geolocation failure (denied / no permission) degrades to
 * `(0, 0)` so the SOS row still lands. Country code resolution
 * uses the browser's IANA timezone as a best-effort offline hint
 * for the banner's local-emergency lookup.
 *
 * Installed by prompt [V.UX.13]; hold-to-confirm + active-state
 * handoff added by [V.UX.35].
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSosControllerTrigger, type TriggerSosRequestDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { setActiveSos } from '../../lib/active-sos';
import { announce } from '../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const HOLD_DURATION_MS = 3000;

type Phase = 'idle' | 'holding' | 'locating' | 'sending' | 'sent' | 'error';

export function SosFab() {
  const token = useAuthToken();
  const [phase, setPhase] = useState<Phase>('idle');
  const [holdProgress, setHoldProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const holdStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef<boolean>(false);
  const lastCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  const triggerMutation = useSosControllerTrigger({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as { id?: string } | undefined;
        if (body?.id) {
          setActiveSos({
            id: body.id,
            triggeredAt: new Date().toISOString(),
            lat: lastCoordsRef.current.lat,
            lng: lastCoordsRef.current.lng,
            countryCode: bestEffortCountryCode(),
          });
        }
        announce('SOS triggered. Trusted contacts notified.', 'assertive');
        setPhase('sent');
        window.setTimeout(() => setPhase('idle'), 4000);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'SOS failed.'}`);
        setPhase('error');
        announce('SOS failed to send. Try again.', 'assertive');
      },
    },
  });

  function getCoords(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ lat: 0, lng: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 0, lng: 0 }),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
      );
    });
  }

  async function fire() {
    if (firedRef.current) return;
    firedRef.current = true;
    setErrorMsg(null);
    setPhase('locating');
    const center = await getCoords();
    lastCoordsRef.current = center;
    setPhase('sending');
    const data: TriggerSosRequestDto = {
      center,
      trigger: 'panic' as TriggerSosRequestDto['trigger'],
    };
    triggerMutation.mutate({ data });
  }

  function tick() {
    const elapsed = Date.now() - holdStartRef.current;
    const pct = Math.min(1, elapsed / HOLD_DURATION_MS);
    setHoldProgress(pct);
    if (pct >= 1) {
      cancelHoldAnimation();
      void fire();
      return;
    }
    rafRef.current = window.requestAnimationFrame(tick);
  }

  function startHold() {
    if (token === null) return;
    if (phase === 'sending' || phase === 'locating' || phase === 'sent') return;
    firedRef.current = false;
    setErrorMsg(null);
    setPhase('holding');
    setHoldProgress(0);
    holdStartRef.current = Date.now();
    rafRef.current = window.requestAnimationFrame(tick);
  }

  function cancelHoldAnimation() {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function endHold() {
    cancelHoldAnimation();
    if (phase !== 'holding') return;
    if (firedRef.current) return; // hit threshold during this gesture
    setPhase('idle');
    setHoldProgress(0);
    announce('Hold for 3 seconds to trigger SOS.');
  }

  useEffect(() => {
    return () => cancelHoldAnimation();
  }, []);

  if (phase === 'sent') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 max-w-xs rounded-full border-2 border-emerald-500 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg dark:text-emerald-300"
      >
        ✓ SOS sent · contacts notified
      </div>
    );
  }

  const disabled = token === null;
  const filling = phase === 'holding';
  const working = phase === 'locating' || phase === 'sending';
  const fillPct = Math.round(holdProgress * 100);
  return (
    <button
      type="button"
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={(e) => {
        e.preventDefault();
        startHold();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        endHold();
      }}
      onTouchCancel={endHold}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (phase === 'idle') startHold();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          endHold();
        }
      }}
      disabled={disabled || working}
      aria-label={
        disabled
          ? 'Sign in to enable SOS'
          : working
            ? 'Sending SOS'
            : filling
              ? `Hold to trigger SOS — ${fillPct}%`
              : 'Hold for 3 seconds to trigger SOS'
      }
      title={disabled ? 'Sign in to enable SOS' : 'Hold 3 seconds to trigger SOS'}
      style={{
        background: filling ? `conic-gradient(#fff ${fillPct * 3.6}deg, #e11d48 0deg)` : undefined,
      }}
      className={[
        'fixed bottom-4 right-4 z-50 inline-flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold shadow-lg transition focus:outline-none focus:ring-4 select-none',
        disabled
          ? 'bg-rose-500/40 text-white/70 cursor-not-allowed'
          : working
            ? 'bg-rose-700 text-white cursor-progress'
            : filling
              ? 'text-rose-700 ring-rose-300 ring-4 scale-105'
              : 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-300 active:scale-95 animate-pulse',
      ].join(' ')}
    >
      <span className="flex flex-col items-center" aria-hidden>
        <span className="text-lg leading-none">🆘</span>
        <span className="text-[10px] leading-tight">
          {working ? '…' : filling ? `${fillPct}%` : 'HOLD'}
        </span>
      </span>
      {errorMsg ? (
        <span
          role="alert"
          className="absolute bottom-full right-0 mb-2 w-56 rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger"
        >
          {errorMsg}
        </span>
      ) : null}
    </button>
  );
}

/** V.UX.35 — best-effort country-code derivation from the browser's
 *  IANA timezone. Offline + free; covers high-traffic markets. The
 *  banner uses this as the default before the user picks one
 *  explicitly. Returns null when unmapped. */
function bestEffortCountryCode(): string | null {
  if (typeof Intl === 'undefined') return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const map: Record<string, string> = {
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'America/Mexico_City': 'MX',
      'Europe/London': 'GB',
      'Europe/Dublin': 'IE',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Madrid': 'ES',
      'Europe/Rome': 'IT',
      'Europe/Lisbon': 'PT',
      'Europe/Amsterdam': 'NL',
      'Europe/Zurich': 'CH',
      'Europe/Vienna': 'AT',
      'Europe/Stockholm': 'SE',
      'Europe/Athens': 'GR',
      'Europe/Istanbul': 'TR',
      'Asia/Tokyo': 'JP',
      'Asia/Seoul': 'KR',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG',
      'Asia/Bangkok': 'TH',
      'Asia/Jakarta': 'ID',
      'Asia/Kolkata': 'IN',
      'Asia/Dubai': 'AE',
      'Asia/Tel_Aviv': 'IL',
      'Australia/Sydney': 'AU',
      'Pacific/Auckland': 'NZ',
      'America/Sao_Paulo': 'BR',
      'America/Argentina/Buenos_Aires': 'AR',
      'Africa/Johannesburg': 'ZA',
      'Africa/Cairo': 'EG',
    };
    return map[tz] ?? null;
  } catch {
    return null;
  }
}
