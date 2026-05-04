/**
 * V.UX.35 — sticky "active SOS" banner. Mounted once in
 * `app/layout.tsx`. Reads from the `lib/active-sos.ts` store
 * (sessionStorage-backed) so a hard reload mid-emergency doesn't
 * lose the panel.
 *
 * Surfaces:
 *   - "I'm OK — cancel SOS" big button (POSTs /safety/sos/:id/cancel
 *     and clears the local state on 200).
 *   - Local emergency-number row (police / ambulance / fire) for the
 *     country we best-effort-detected at trigger time. Each row is
 *     a `tel:` link. Country picker for switching.
 *   - Fixed top of viewport, red border, role="region".
 *
 * Renders nothing when there's no active SOS.
 *
 * Installed by prompt [V.UX.35].
 */
'use client';

import { useEffect, useState } from 'react';
import { useEmergencyNumbersControllerGet, useSosControllerCancel } from '@app/sdk';
import {
  getActiveSos,
  setActiveSos,
  subscribeActiveSos,
  type ActiveSosState,
} from '../../lib/active-sos';
import { announce } from '../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

interface EmergencyDto {
  countryCode: string;
  countryName: string;
  universal: string | null;
  police: string;
  ambulance: string;
  fire: string;
  note: string | null;
}

const SUPPORTED_COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'IN', name: 'India' },
  { code: 'TH', name: 'Thailand' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AE', name: 'UAE' },
];

export function ActiveSosBanner() {
  const [active, setActive] = useState<ActiveSosState | null>(null);
  const [country, setCountry] = useState<string>('US');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const initial = getActiveSos();
    setActive(initial);
    if (initial?.countryCode) setCountry(initial.countryCode);
    return subscribeActiveSos((s) => {
      setActive(s);
      if (s?.countryCode) setCountry(s.countryCode);
    });
  }, []);

  const numbers = useEmergencyNumbersControllerGet(country, {
    query: { enabled: active !== null, retry: false },
  });
  const cancel = useSosControllerCancel();

  if (active === null) return null;

  const info = numbers.data?.data as EmergencyDto | undefined;

  async function handleCancel() {
    if (!active) return;
    setErrMsg(null);
    try {
      await cancel.mutateAsync({ id: active.id });
      announce('SOS cancelled. You marked yourself OK.', 'assertive');
      setActiveSos(null);
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Cancel failed.'}`);
    }
  }

  const triggeredAt = new Date(active.triggeredAt);
  return (
    <div
      role="region"
      aria-label="Active SOS"
      className="sticky top-0 z-40 w-full border-b-4 border-rose-600 bg-rose-50 text-rose-900 shadow-md dark:bg-rose-950/40 dark:text-rose-100"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold">
            🆘 SOS active · {triggeredAt.toLocaleTimeString()} · contacts notified
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <span className="text-muted">Country:</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded border border-rose-300/40 bg-transparent px-1 py-0.5 text-xs"
                aria-label="Country for local emergency numbers"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {info ? (
              <>
                <a
                  href={`tel:${info.universal ?? info.police}`}
                  className="rounded-md bg-rose-700 px-2 py-1 font-semibold text-white hover:bg-rose-800"
                >
                  📞 {info.universal ?? info.police} ({info.countryName})
                </a>
                <a
                  href={`tel:${info.police}`}
                  className="rounded border border-rose-300/40 px-2 py-0.5"
                  title="Police"
                >
                  Police {info.police}
                </a>
                <a
                  href={`tel:${info.ambulance}`}
                  className="rounded border border-rose-300/40 px-2 py-0.5"
                  title="Ambulance"
                >
                  Ambulance {info.ambulance}
                </a>
                <a
                  href={`tel:${info.fire}`}
                  className="rounded border border-rose-300/40 px-2 py-0.5"
                  title="Fire"
                >
                  Fire {info.fire}
                </a>
                {info.note ? <span className="text-muted">{info.note}</span> : null}
              </>
            ) : numbers.isLoading ? (
              <span className="text-muted">Loading numbers…</span>
            ) : null}
          </div>
          {errMsg ? <p className="text-xs text-danger">{errMsg}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={cancel.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-50"
        >
          {cancel.isPending ? 'Cancelling…' : "✓ I'm OK — cancel SOS"}
        </button>
      </div>
    </div>
  );
}
