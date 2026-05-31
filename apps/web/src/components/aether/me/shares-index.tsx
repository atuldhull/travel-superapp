'use client';

/**
 * <SharesIndex> — every share link the caller has minted, listed in
 * one Aether-styled view. Indexed per-trip because the backend share
 * list endpoint is trip-scoped (no aggregate listing yet).
 *
 * Each trip with at least one share renders a band:
 *   • trip title + status
 *   • list of share rows (shareCode · createdAt · expires / revoked)
 *   • Revoke button per active share
 *
 * Revoked shares stay listed (greyed-out, "revoked" badge) so the
 * caller can confirm the cleanup. The full per-trip share view lives
 * on the journey dashboard; this page is the cross-trip aggregate.
 */
import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from '@app/aether-core';
import {
  getTripControllerListSharesQueryKey,
  useTripControllerList,
  useTripControllerListShares,
  useTripControllerRevokeShare,
  type ListTripSharesResponseDto,
  type TripDto,
  type TripShareOwnerDto,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
// AE355 — composite auth hook.
import { useAetherAuth } from '../use-aether-auth';
import { useViewport } from '../use-viewport';
// AE312 — canonical singular/plural for "N share(s)".
import { countLabel } from '../../../lib/pluralise';
// AE326 — shared fmtDate (was duplicated here + in dispatch/journeys).
import { fmtDate } from '../../../lib/aether-dates';
// AE333 — canonical share-URL builder (was inlined here + in pulse).
import { buildShareUrl } from '../../../lib/format-share-url';
// AE334 — shared clipboard helper (was inlined navigator.clipboard).
import { copyTextToClipboard } from '../../../lib/copy-text';
// AE346 — shared trips-extractor (replaces ad-hoc unsafe cast).
import { tripsFromQuery } from '../../../lib/trips-from-query';
// AE351 — value-keyed transient flag (was inline setTimeout(set, null)).
import { useTransientValue } from '../use-transient-value';

// AE356 — fmtExpiry was a private clone of the null-returning date
// formatter. Re-export the shared variant under the local name so the
// call sites need no further change.
import { fmtDateOrNull as fmtExpiry } from '../../../lib/aether-dates';

/** One trip's row of shares. Each <TripShareBand> mounts its own
 *  useTripControllerListShares — keeping the hook call in a child
 *  component preserves the rules-of-hooks invariant. */
function TripShareBand({ trip }: { readonly trip: TripDto }): React.ReactElement | null {
  const theme = useTheme();
  const queryClient = useQueryClient();
  // AE351 — was useState<string|null>+inline setTimeout; shared hook.
  const [copiedCode, setCopiedCode] = useTransientValue<string>(2000);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const sharesQuery = useTripControllerListShares(trip.id, {
    query: { retry: 1 },
  });
  const shares: TripShareOwnerDto[] =
    (sharesQuery.data?.data as ListTripSharesResponseDto | undefined)?.shares ?? [];

  const revokeMutation = useTripControllerRevokeShare({
    mutation: {
      onSuccess: () => {
        setRevokeError(null);
        void queryClient.invalidateQueries({
          queryKey: getTripControllerListSharesQueryKey(trip.id),
        });
      },
      onError: (err: unknown) => {
        setRevokeError(err instanceof Error ? err.message : 'Could not revoke this share.');
      },
    },
  });

  if (sharesQuery.isPending || shares.length === 0) return null;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Reveal>
      <div
        style={{
          marginTop: theme.space.gutter,
          padding: theme.space.loose,
          borderRadius: theme.radius.lg,
          background: surface.soft,
          border: `1px solid ${ink.whisper}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.space.comfy,
            flexWrap: 'wrap',
            marginBottom: theme.space.comfy,
          }}
        >
          <div>
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
              {trip.status} · {countLabel(shares.length, 'share')}
            </p>
            <h3
              style={{
                fontFamily: theme.font.display,
                fontSize: 'clamp(22px, 2.4vw, 30px)',
                lineHeight: 1.2,
                letterSpacing: '-0.014em',
                fontWeight: 600,
                margin: `${theme.space.hairline}px 0 0`,
                color: ink.base,
              }}
            >
              {trip.title}
            </h3>
          </div>
          <Link
            href={`/aether/journey/${trip.id}`}
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              fontWeight: 600,
              color: accent.deep,
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            Open journey →
          </Link>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: theme.space.tight,
          }}
        >
          {shares.map((s) => {
            // AE333 — buildShareUrl encodes oddball codes + handles origin.
            const sharedUrl = buildShareUrl({ origin, code: s.shareCode });
            const expiry = fmtExpiry(s.expiresAt);
            const revoked = !s.publicRead;
            return (
              <li
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  alignItems: 'center',
                  gap: theme.space.comfy,
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.md,
                  background: revoked ? ochre.whisper : surface.base,
                  border: `1px solid ${revoked ? ochre.deep : olive.whisper}`,
                  opacity: revoked ? 0.62 : 1,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <code
                    style={{
                      display: 'block',
                      fontFamily: theme.font.mono,
                      fontSize: 12,
                      color: ink.base,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sharedUrl}
                  </code>
                  <div
                    style={{
                      marginTop: 4,
                      display: 'flex',
                      gap: theme.space.tight,
                      flexWrap: 'wrap',
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: ink.soft,
                    }}
                  >
                    <span>minted {fmtDate(s.createdAt)}</span>
                    {expiry !== null && (
                      <>
                        <span aria-hidden>·</span>
                        <span>expires {expiry}</span>
                      </>
                    )}
                    {revoked && (
                      <>
                        <span aria-hidden>·</span>
                        <span style={{ color: ochre.deep, fontWeight: 600 }}>revoked</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: theme.space.tight, alignItems: 'center' }}>
                  {!revoked && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void copyTextToClipboard(sharedUrl).then((ok) => {
                            if (!ok) return;
                            setCopiedCode(s.shareCode);
                          });
                        }}
                        style={{
                          padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                          borderRadius: theme.radius.pill,
                          background: copiedCode === s.shareCode ? olive.deep : ink.base,
                          color: surface.base,
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background 220ms',
                        }}
                      >
                        {copiedCode === s.shareCode ? '✓ Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeMutation.mutate({ id: trip.id, code: s.shareCode })}
                        disabled={revokeMutation.isPending}
                        style={{
                          padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                          borderRadius: theme.radius.pill,
                          background: 'transparent',
                          border: `1px solid rgba(184, 58, 46, 0.4)`,
                          color: '#8a2418',
                          fontFamily: theme.font.ui,
                          fontSize: theme.text.small.size,
                          fontWeight: 600,
                          cursor: revokeMutation.isPending ? 'wait' : 'pointer',
                          opacity: revokeMutation.isPending ? 0.6 : 1,
                        }}
                      >
                        {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {revokeError !== null && (
          <p
            role="alert"
            style={{
              marginTop: theme.space.tight,
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              color: '#8a2418',
            }}
          >
            {revokeError}
          </p>
        )}
      </div>
    </Reveal>
  );
}

export function SharesIndex(): React.ReactElement {
  const theme = useTheme();
  const { isNarrow } = useViewport();
  // AE355 — composite auth hook.
  const { token, bootComplete, isAuthed } = useAetherAuth();

  // Pull both active + archived trips so all shares are findable.
  const activeQuery = useTripControllerList(
    { limit: '50', archived: 'false' },
    { query: { enabled: isAuthed } },
  );
  const archivedQuery = useTripControllerList(
    { limit: '50', archived: 'true' },
    { query: { enabled: isAuthed } },
  );
  // AE346 — shared extractor.
  const activeTrips = tripsFromQuery<TripDto>(activeQuery);
  const archivedTrips = tripsFromQuery<TripDto>(archivedQuery);
  const trips: readonly TripDto[] = [...activeTrips, ...archivedTrips];

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  const loading = isAuthed && (activeQuery.isPending || archivedQuery.isPending);

  return (
    <div
      style={{
        background: surface.base,
        color: ink.base,
        fontFamily: theme.font.ui,
        minHeight: '100vh',
      }}
    >
      <DriftNav />

      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: isNarrow
            ? `${theme.space.hero}px ${theme.space.comfy}px ${theme.space.gutter}px`
            : `${theme.space.surface}px ${theme.space.margin}px ${theme.space.hero}px`,
        }}
      >
        <Reveal>
          <p
            style={{
              fontFamily: theme.font.ui,
              fontSize: theme.text.small.size,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: accent.deep,
              fontWeight: 600,
              margin: 0,
              marginBottom: theme.space.tight,
            }}
          >
            Your shares · साझा यात्राएँ
          </p>
          <h1
            style={{
              fontFamily: theme.font.display,
              fontSize: 'clamp(40px, 6vw, 84px)',
              lineHeight: 1.02,
              letterSpacing: '-0.024em',
              fontWeight: 600,
              margin: 0,
              color: ink.base,
            }}
          >
            Links you have minted.
          </h1>
          <p
            style={{
              fontFamily: theme.font.display,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2vw, 23px)',
              lineHeight: 1.55,
              color: ink.soft,
              margin: `${theme.space.loose}px 0 0`,
              maxWidth: '54ch',
            }}
          >
            Every share link, every journey, in one place. Copy a link to pass on; revoke one to
            close it. Recipients see a read-only view — they cannot edit.
          </p>
        </Reveal>

        {/* Auth wall */}
        {bootComplete && !isAuthed && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: ochre.whisper,
                border: `1px solid ${ochre.deep}`,
                fontFamily: theme.font.display,
                fontSize: 20,
                lineHeight: 1.5,
                color: ink.base,
              }}
            >
              These shares are private. Sign in to read them.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/login?next=/aether/me/shares"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `${theme.space.tight}px ${theme.space.loose}px`,
                    borderRadius: theme.radius.pill,
                    background: accent.base,
                    color: surface.base,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.button.size,
                    fontWeight: theme.text.button.weight,
                    textDecoration: 'none',
                  }}
                >
                  Sign in →
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Loading */}
        {loading && (
          <Reveal>
            <div
              style={{
                textAlign: 'center',
                padding: `${theme.space.hero}px 0`,
                fontFamily: theme.font.display,
                fontStyle: 'italic',
                fontSize: 22,
                color: ink.soft,
              }}
            >
              Gathering your shares…
            </div>
          </Reveal>
        )}

        {/* Filter chips + new-link CTA */}
        {isAuthed && !loading && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.hero,
                marginBottom: theme.space.gutter,
                display: 'flex',
                gap: theme.space.tight,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/aether/me/journeys"
                style={{
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: 'transparent',
                  border: `1px solid ${ink.whisper}`,
                  color: ink.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.small.size,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                ← All journeys
              </Link>
              <Link
                href="/aether/plan"
                style={{
                  padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                  borderRadius: theme.radius.pill,
                  background: ink.base,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.button.size,
                  fontWeight: theme.text.button.weight,
                  textDecoration: 'none',
                }}
              >
                Sketch another →
              </Link>
            </div>
          </Reveal>
        )}

        {/* Per-trip bands. Each subcomponent gates itself on empty. */}
        {isAuthed && !loading && trips.length > 0 && (
          <div>
            {trips.map((t) => (
              <TripShareBand key={t.id} trip={t} />
            ))}
          </div>
        )}

        {/* Empty state — no trips at all */}
        {isAuthed && !loading && trips.length === 0 && (
          <Reveal>
            <div
              style={{
                marginTop: theme.space.comfy,
                padding: theme.space.hero,
                borderRadius: theme.radius.lg,
                background: surface.soft,
                border: `1px dashed ${olive.deep}`,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: theme.font.display,
                  fontStyle: 'italic',
                  fontSize: 22,
                  lineHeight: 1.5,
                  color: ink.soft,
                  margin: 0,
                  marginBottom: theme.space.comfy,
                }}
              >
                No shares yet. Sketch a journey first, then mint a link.
              </p>
              <Link
                href="/aether/plan"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${theme.space.tight}px ${theme.space.loose}px`,
                  borderRadius: theme.radius.pill,
                  background: accent.base,
                  color: surface.base,
                  fontFamily: theme.font.ui,
                  fontSize: theme.text.button.size,
                  fontWeight: theme.text.button.weight,
                  textDecoration: 'none',
                }}
              >
                Begin the yatra
                <span aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
