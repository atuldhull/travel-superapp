/**
 * I5 (Phase 6) — Offline survival phrases.
 *
 * A mid-trip surface: big copyable phrases + emergency numbers for
 * every country whose primer the traveler has cached on this device
 * (I3 writes the cache when the primer page loads online).
 *
 * Deliberately NOT auth-gated and NOT network-dependent:
 *  - It reads ONLY the local IndexedDB primer cache. Nothing leaves
 *    the device.
 *  - If it required a live token it would be useless offline — the
 *    in-memory access token is gone after a reload and the refresh
 *    call fails with no network. So this page works for an
 *    anonymous, offline, just-reloaded browser as long as a primer
 *    was cached earlier. That is the whole point.
 *  - The cached primer is editorial content (visa / scams / phrases),
 *    not user data — there's nothing sensitive to gate.
 *
 * Honest empty state: when nothing is cached we say exactly how to
 * fix it (open the primer for a country once online).
 *
 * Installed for Phase 6 (I5).
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Phone, Languages } from 'lucide-react';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { Skeleton } from '../../../../components/ui/skeleton';
import {
  listCountryPrimers,
  type OfflinePrimerSnapshot,
} from '../../../../lib/offline-primer-cache';
import { formatSavedAt } from '../../../../lib/offline-trip-cache';

interface PhraseRow {
  readonly english: string;
  readonly translation: string;
}
interface EmergencyRow {
  readonly label: string;
  readonly number: string;
}
interface PrimerView {
  readonly cc: string;
  readonly countryName: string;
  readonly fetchedAt: number;
  readonly phrases: readonly PhraseRow[];
  readonly emergency: readonly EmergencyRow[];
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/** Defensive narrow of a cached `CountryPrimerDto` — the cache stores
 *  it as `unknown`, so we never trust the shape. */
function toPrimerView(snap: OfflinePrimerSnapshot): PrimerView | null {
  const p = snap.primer;
  if (typeof p !== 'object' || p === null) return null;
  const rec = p as Record<string, unknown>;
  const countryName = str(rec['countryName']) ?? snap.cc.toUpperCase();

  const phrases: PhraseRow[] = [];
  const rawPhrases = Array.isArray(rec['languagePhrases']) ? rec['languagePhrases'] : [];
  for (const row of rawPhrases) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const english = str(r['english']);
    const translation = str(r['translation']);
    if (english && translation) phrases.push({ english, translation });
  }

  const emergency: EmergencyRow[] = [];
  const rawEmergency = Array.isArray(rec['emergencyNumbers']) ? rec['emergencyNumbers'] : [];
  for (const row of rawEmergency) {
    if (typeof row !== 'object' || row === null) continue;
    const r = row as Record<string, unknown>;
    const label = str(r['label']);
    const number = str(r['number']);
    if (label && number) emergency.push({ label, number });
  }

  return { cc: snap.cc, countryName, fetchedAt: snap.fetchedAt, phrases, emergency };
}

export default function TripPhrasesPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';

  const [primers, setPrimers] = useState<readonly PrimerView[] | null>(null);
  const [selectedCc, setSelectedCc] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const snaps = await listCountryPrimers();
      if (!alive) return;
      const views = snaps.map(toPrimerView).filter((v): v is PrimerView => v !== null);
      setPrimers(views);
      // Default the selector to the freshest cached country.
      if (views.length > 0 && views[0]) setSelectedCc(views[0].cc);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(
    () => primers?.find((p) => p.cc === selectedCc) ?? null,
    [primers, selectedCc],
  );

  const copy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(key);
          window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
        })
        .catch(() => {
          // ignore — the text is still selectable / long-pressable
        });
    }
  };

  return (
    <main className="space-y-6">
      <p>
        <Link
          href={`/trips/${tripId}` as never}
          className="inline-flex items-center gap-1 text-sm text-muted hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
        </Link>
      </p>

      <header className="space-y-1">
        <h1 className="inline-flex items-center gap-2 font-display text-3xl text-surface-foreground">
          <Languages aria-hidden className="h-6 w-6 text-gold-600" /> Survival phrases
        </h1>
        <p className="text-sm text-muted">
          Big, tappable phrases and emergency numbers — saved on this device, so they work with no
          signal.
        </p>
      </header>

      {primers === null ? (
        <Card className="p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-3 h-20 w-full" />
        </Card>
      ) : primers.length === 0 ? (
        <Card className="p-5">
          <CardHeader>
            <CardTitle>No phrases saved yet</CardTitle>
            <CardSubtitle>
              Open the{' '}
              <Link
                href={`/trips/${tripId}/primer` as never}
                className="text-gold-600 underline-offset-4 hover:underline"
              >
                pre-trip primer
              </Link>{' '}
              for a country while you&apos;re online. We&apos;ll save its phrases and emergency
              numbers here automatically so they&apos;re ready when you land.
            </CardSubtitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          {primers.length > 1 ? (
            <Card className="p-4">
              <Field label="Country">
                <select
                  value={selectedCc}
                  onChange={(e) => setSelectedCc(e.target.value)}
                  className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
                >
                  {primers.map((p) => (
                    <option key={p.cc} value={p.cc}>
                      {p.countryName}
                    </option>
                  ))}
                </select>
              </Field>
            </Card>
          ) : null}

          {selected ? (
            <>
              <p className="text-xs text-muted">
                {selected.countryName} · saved {formatSavedAt(selected.fetchedAt) ?? 'a while ago'}{' '}
                on this device
              </p>

              {/* Emergency numbers first — the most time-critical row. */}
              {selected.emergency.length > 0 ? (
                <section className="space-y-2">
                  <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    <Phone aria-hidden className="h-3.5 w-3.5" /> Emergency numbers
                  </h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {selected.emergency.map((e) => (
                      <li key={`${e.label}:${e.number}`}>
                        <a
                          href={`tel:${e.number}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 transition hover:border-danger/50"
                        >
                          <span className="text-sm font-medium text-surface-foreground">
                            {e.label}
                          </span>
                          <span className="font-mono text-xl font-semibold text-danger">
                            {e.number}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Phrases — big text, tap anywhere on the card to copy. */}
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Phrases
                </h2>
                {selected.phrases.length === 0 ? (
                  <Card className="p-5">
                    <CardSubtitle>
                      The cached primer for {selected.countryName} has no survival phrases.
                    </CardSubtitle>
                  </Card>
                ) : (
                  <ul className="space-y-2">
                    {selected.phrases.map((ph) => {
                      const key = `${selected.cc}:${ph.english}`;
                      const isCopied = copied === key;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => copy(ph.translation, key)}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-gold-600/15 bg-surface/70 px-5 py-4 text-left shadow-(--shadow-depth-1) transition hover:border-gold-600/40 hover:bg-surface"
                          >
                            <span className="min-w-0">
                              <span className="block font-display text-2xl leading-tight text-surface-foreground">
                                {ph.translation}
                              </span>
                              <span className="mt-0.5 block text-sm text-muted">{ph.english}</span>
                            </span>
                            <span
                              className="inline-flex shrink-0 items-center gap-1 text-xs text-muted"
                              aria-hidden
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-4 w-4 text-gold-600" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" /> Copy
                                </>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
