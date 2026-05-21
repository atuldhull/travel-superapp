/**
 * Phase 5 (J1) — publish-to-feed control for a trip's owner.
 *
 * The `POST/DELETE /feed/trips/:id/publish` API shipped in POST.2B.2
 * but had NO web trigger — a real shipped-but-dark gap. This panel
 * closes it: it reads the publication status, lets the owner choose
 * a visibility, and publish / re-publish / unpublish.
 *
 * Honest behaviour:
 *  - The API privacy-fences publishing to ENDED trips only. We check
 *    `endsOn` client-side and, when the trip hasn't ended, render the
 *    panel in an explained disabled state instead of letting the
 *    user hit a 422.
 *  - PUBLIC coarsens the exposed location server-side (INVARIANT B);
 *    we say so plainly next to the option.
 *  - "Publish" is distinct from the trip's Lock (`trip.status`,
 *    confusingly also called "published") — this panel is about the
 *    community feed, and the copy makes that explicit.
 *
 * Self-contained: own fetch + mutation state, mounted with a one-line
 * insert in the trip page (mirrors the G1 <ItemCheckbox> pattern).
 *
 * Installed by prompt [J1].
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Users, Lock, Loader2 } from 'lucide-react';
import {
  getTripPublication,
  publishTrip,
  unpublishTrip,
  type PublicationStatus,
  type Visibility,
} from '../../lib/two-oh-api';

interface PublishPanelProps {
  readonly tripId: string;
  /** ISO date string or null — the trip's `endsOn` (already coerced). */
  readonly endsOn: string | null;
}

/** A trip is publishable only once it has definitively ended. */
function hasEnded(endsOnIso: string | null): boolean {
  if (!endsOnIso) return false;
  const t = new Date(endsOnIso).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

export function PublishPanel({ tripId, endsOn }: PublishPanelProps) {
  const [status, setStatus] = useState<PublicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The visibility the owner is about to publish with. Defaults to
  // FOLLOWERS (the API default, D2) and syncs to the live value once
  // the status loads.
  const [choice, setChoice] = useState<Visibility>('FOLLOWERS');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await getTripPublication(tripId);
        if (!alive) return;
        setStatus(s);
        if (s.visibility === 'PUBLIC' || s.visibility === 'FOLLOWERS') setChoice(s.visibility);
      } catch {
        // A failure here just means we render the default unpublished
        // state — the publish call itself surfaces real errors.
        if (alive) setStatus(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tripId]);

  const ended = hasEnded(endsOn);

  const doPublish = async () => {
    setBusy(true);
    setError(null);
    try {
      const pub = await publishTrip(tripId, { visibility: choice });
      setStatus({
        published: pub.publishedAt !== null,
        visibility: pub.visibility,
        publishedAt: pub.publishedAt,
        exposedLat: pub.exposedLat,
        exposedLng: pub.exposedLng,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const doUnpublish = async () => {
    setBusy(true);
    setError(null);
    try {
      await unpublishTrip(tripId);
      setStatus({
        published: false,
        visibility: 'PRIVATE',
        publishedAt: null,
        exposedLat: null,
        exposedLng: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unpublish — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-gold-600/15 bg-surface/60 px-4 py-3 text-sm text-muted">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Checking publication status…
      </div>
    );
  }

  const isLive = status?.published === true;

  return (
    <div className="mt-3 rounded-xl border border-gold-600/20 bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <Globe aria-hidden className="h-4 w-4 text-gold-600" />
        <h3 className="text-sm font-semibold text-surface-foreground">Community feed</h3>
        {isLive ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Live · {status?.visibility === 'PUBLIC' ? 'Public' : 'Followers'}
          </span>
        ) : null}
      </div>

      {!ended ? (
        // Privacy fence — the API rejects publishing a trip that
        // hasn't ended; explain rather than letting the user 422.
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
          <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          You can share this trip to the feed once it has ended — that keeps live itineraries
          private while you&apos;re still travelling.
        </p>
      ) : isLive ? (
        <>
          <p className="mt-2 text-xs text-muted">
            This trip is in the community feed. People can discover it
            {status?.visibility === 'PUBLIC'
              ? ' publicly (its location is coarsened to ~city level).'
              : ' if they follow you.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/feed"
              className="rounded-full border border-gold-600/25 px-3 py-1.5 text-xs font-medium text-gold-700 transition hover:bg-gold-500/10 dark:text-gold-300"
            >
              View in feed
            </Link>
            <button
              type="button"
              onClick={doUnpublish}
              disabled={busy}
              className="rounded-full border border-muted/30 px-3 py-1.5 text-xs font-medium text-muted transition hover:text-surface-foreground disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Unpublish'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            Share this finished trip so others can discover it.
          </p>
          <fieldset className="mt-3 space-y-1.5" disabled={busy}>
            <legend className="sr-only">Who can see this trip</legend>
            <VisibilityOption
              value="FOLLOWERS"
              current={choice}
              onPick={setChoice}
              Icon={Users}
              label="Followers only"
              hint="People who follow you can see it."
            />
            <VisibilityOption
              value="PUBLIC"
              current={choice}
              onPick={setChoice}
              Icon={Globe}
              label="Public"
              hint="Anyone can discover it; the location is coarsened to ~city level."
            />
          </fieldset>
          <button
            type="button"
            onClick={doPublish}
            disabled={busy}
            className="mt-3 rounded-full bg-gold-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-700 disabled:opacity-50"
          >
            {busy ? 'Publishing…' : 'Publish to feed'}
          </button>
        </>
      )}

      {error ? (
        <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface VisibilityOptionProps {
  readonly value: Visibility;
  readonly current: Visibility;
  readonly onPick: (v: Visibility) => void;
  readonly Icon: typeof Globe;
  readonly label: string;
  readonly hint: string;
}

function VisibilityOption({ value, current, onPick, Icon, label, hint }: VisibilityOptionProps) {
  const selected = current === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition ${
        selected ? 'border-gold-600/50 bg-gold-500/8' : 'border-muted/20 hover:border-gold-600/30'
      }`}
    >
      <input
        type="radio"
        name="trip-visibility"
        value={value}
        checked={selected}
        onChange={() => onPick(value)}
        className="mt-1 accent-gold-600"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-medium text-surface-foreground">
          <Icon aria-hidden className="h-3.5 w-3.5 text-gold-600" /> {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
      </span>
    </label>
  );
}
