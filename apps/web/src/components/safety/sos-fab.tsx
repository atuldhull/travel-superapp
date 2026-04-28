/**
 * V.UX.13 — persistent SOS floating action button. Renders for
 * every signed-in user, in the bottom-right of every screen.
 *
 *   1. Tap red pill → confirm modal.
 *   2. Confirm → request browser geolocation → POST /safety/sos.
 *   3. Stub SMS adapter fans the event out to the caller's pre-set
 *      trusted contacts.
 *
 * Geolocation failure (browser denied / no permission) gracefully
 * downgrades to a `(0, 0)` center so the SOS row is still recorded
 * — operators can still see "user X triggered SOS" even without a
 * fix. Better a warning than a missed call.
 *
 * Anonymous callers get a "sign in to enable SOS" tooltip — we
 * still render the FAB so the affordance is consistent across
 * pages, but tapping it doesn't do anything.
 *
 * Installed by prompt [V.UX.13].
 */
'use client';

import { useState } from 'react';
import { useSosControllerTrigger, type TriggerSosRequestDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

type Phase = 'idle' | 'confirm' | 'locating' | 'sending' | 'sent' | 'error';

export function SosFab() {
  const token = useAuthToken();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerMutation = useSosControllerTrigger({
    mutation: {
      onSuccess: () => {
        setPhase('sent');
        window.setTimeout(() => setPhase('idle'), 4000);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'SOS failed.'}`);
        setPhase('error');
      },
    },
  });

  function getCoords(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        // No geolocation API at all — degrade to (0, 0). The row
        // still lands; ops/dispatch can call out-of-band.
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

  async function confirmSos() {
    setErrorMsg(null);
    setPhase('locating');
    const center = await getCoords();
    setPhase('sending');
    const data: TriggerSosRequestDto = {
      center,
      trigger: 'panic' as TriggerSosRequestDto['trigger'],
    };
    triggerMutation.mutate({ data });
  }

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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (token === null) return;
          setPhase('confirm');
          setErrorMsg(null);
        }}
        disabled={token === null}
        aria-label={token === null ? 'Sign in to enable SOS' : 'Trigger SOS'}
        title={token === null ? 'Sign in to enable SOS' : 'Trigger SOS'}
        className={[
          'fixed bottom-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold shadow-lg transition focus:outline-none focus:ring-4',
          token === null
            ? 'bg-rose-500/40 text-white/70 cursor-not-allowed'
            : 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-300 active:scale-95',
        ].join(' ')}
      >
        <span aria-hidden="true">🆘</span>
        SOS
      </button>
      {phase !== 'idle' ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-confirm-title"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border-2 border-rose-500 bg-surface p-5 shadow-xl">
            <h2 id="sos-confirm-title" className="text-lg font-bold text-rose-600">
              🆘 Trigger SOS?
            </h2>
            <p className="mt-2 text-sm">
              Your trusted contacts will be notified with your current location. Use this only if
              you genuinely need help.
            </p>
            {phase === 'locating' ? (
              <p className="mt-3 text-xs text-muted">📍 Getting your location…</p>
            ) : null}
            {phase === 'sending' ? (
              <p className="mt-3 text-xs text-muted">📡 Sending SOS…</p>
            ) : null}
            {errorMsg ? (
              <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {errorMsg}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhase('idle');
                  setErrorMsg(null);
                }}
                disabled={phase === 'locating' || phase === 'sending'}
                className="rounded-md border border-muted/30 px-3 py-1.5 text-sm hover:bg-muted/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSos}
                disabled={phase === 'locating' || phase === 'sending'}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {phase === 'locating' || phase === 'sending' ? 'Working…' : 'Trigger SOS'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
