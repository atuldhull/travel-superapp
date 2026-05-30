'use client';

/**
 * <JourneyDashboard> — Aether-styled live view of a real trip.
 *
 * Fetches the trip via `useTripControllerGetOne`. Editorial composition:
 *   • Title block: huge display-serif title + status chip + date range
 *   • Facts strip: days · radius · created-on · last-edited
 *   • Stub itinerary card (Phase 1 wires to real itinerary endpoint)
 *   • Open-in-planner CTA → existing /trips/[id] surface
 *
 * Auth-gated. Loading + error states are calm + Aether-styled.
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@app/aether-core';
import {
  getTripControllerGetOneQueryKey,
  useTripControllerArchive,
  useTripControllerDuplicate,
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  useTripControllerShare,
  useTripControllerUnarchive,
  type ItineraryDayDto,
  type ItineraryItemDto,
  type ItineraryListResponseDto,
  type TripDto,
  type TripShareResponseDto,
} from '@app/sdk';
import { useQueryClient } from '@tanstack/react-query';
import { DriftNav } from '../drift-nav';
import { Reveal } from '../drift-sections/reveal';
import { EditorialFooter } from '../drift-sections/editorial-footer';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';
import { useViewport } from '../use-viewport';
import { TripShareCard } from './trip-share-card';

export interface JourneyDashboardProps {
  tripId: string;
}

/** Coerce orval's odd nullable union types (TripDtoStartsOn etc.) into
 *  plain string | null. At runtime these fields are always ISO strings
 *  or null — the schema wrapper is a type-generation artefact. */
function asIso(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function daysBetween(a: unknown, b: unknown): number | null {
  const sa = asIso(a);
  const sb = asIso(b);
  if (sa === null || sb === null) return null;
  const ms = new Date(sb).getTime() - new Date(sa).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function fmtDate(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Pull a string field off the itinerary day's free-form summary blob. */
function readSummaryField(
  summary: ItineraryDayDto['summary'],
  key: 'title' | 'subtitle' | 'theme' | 'note',
): string | null {
  if (summary === null) return null;
  const v = (summary as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

/** Format a HH:MM:SS / ISO string fragment as a soft 4:32 PM style. */
function fmtTime(v: unknown): string | null {
  const s = asIso(v);
  if (s === null) return null;
  // Itinerary times can be naked clock strings (e.g. "09:30:00") OR
  // timestamps. Try Date first; if it doesn't parse, fall back to the
  // raw HH:MM slice.
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && s.length > 8) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(s);
  if (match !== null) {
    const h = Number(match[1]);
    const m = match[2];
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  }
  return null;
}

/** Day-of-week + numeric date e.g. "Mon · Jun 3". */
function fmtDayHead(v: unknown): string {
  const iso = asIso(v);
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const wk = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${wk} · ${md}`;
}

export function JourneyDashboard({ tripId }: JourneyDashboardProps): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addPlace = searchParams.get('addPlace');
  const { isNarrow } = useViewport();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // AE79 — share card preview toggle.
  const [showShareCard, setShowShareCard] = useState<boolean>(false);
  const queryClient = useQueryClient();
  const invalidateThisTrip = (): void => {
    void queryClient.invalidateQueries({ queryKey: getTripControllerGetOneQueryKey(tripId) });
  };
  const archiveMutation = useTripControllerArchive({
    mutation: { onSuccess: invalidateThisTrip },
  });
  const unarchiveMutation = useTripControllerUnarchive({
    mutation: { onSuccess: invalidateThisTrip },
  });
  const duplicateMutation = useTripControllerDuplicate({
    mutation: {
      onSuccess: (created: { data: TripDto }) => {
        const dup = created.data;
        setDuplicateError(null);
        router.push(`/aether/journey/${dup.id}`);
      },
      onError: (err: unknown) => {
        setDuplicateError(err instanceof Error ? err.message : 'Could not duplicate this journey.');
      },
    },
  });
  const shareMutation = useTripControllerShare({
    mutation: {
      onSuccess: (created: TripShareResponseDto) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareUrl(`${origin}/shared/${created.shareCode}`);
        setShareError(null);
      },
      onError: (err: unknown) => {
        setShareError(err instanceof Error ? err.message : 'Could not create the share link.');
      },
    },
  });
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const isAuthed = bootComplete && token !== null;

  // Only fetch once auth has settled (avoids a stampede of 401s on first
  // paint before the silent-refresh resolves).
  const query = useTripControllerGetOne(tripId, {
    query: { enabled: isAuthed, retry: 1 },
  });
  const trip = query.data?.data as TripDto | undefined;

  // Itinerary days — separate endpoint. Fetch only once the trip is
  // resolved so we don't burn calls on the auth-pending state.
  const itineraryQuery = useTripControllerGetItinerary(tripId, {
    query: { enabled: isAuthed && trip !== undefined, retry: 1 },
  });
  const itinerary = itineraryQuery.data?.data as ItineraryListResponseDto | undefined;
  const days: ItineraryDayDto[] = itinerary?.days ?? [];
  const hasItinerary = days.length > 0;

  const ink = theme.color.ink;
  const surface = theme.color.surface;
  const accent = theme.palette.terracotta;
  const ochre = theme.palette.ochre;
  const olive = theme.palette.olive;

  /** Lazy-loads @react-pdf/renderer + the doc component, renders the
   *  PDF to a Blob, and triggers a download. Lazy because react-pdf
   *  is heavy (~600KB gzipped) and only ~1% of viewers use it. */
  async function exportPdf(): Promise<void> {
    if (trip === undefined || exportingPdf) return;
    setExportingPdf(true);
    setExportError(null);
    try {
      const [{ pdf }, { TripPdfDoc }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./trip-pdf-doc'),
      ]);
      const blob = await pdf(<TripPdfDoc trip={trip} itinerary={itinerary ?? null} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aether-${
        trip.title
          .replace(/[^a-z0-9-_ ]/gi, '')
          .replace(/\s+/g, '-')
          .toLowerCase() || 'journey'
      }.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setExportingPdf(false);
    }
  }

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
        {/* Auth-gated */}
        {bootComplete && !isAuthed && (
          <Reveal>
            <div
              style={{
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
              This journey is private. Sign in to read it.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href={`/login?next=/aether/journey/${tripId}`}
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

        {/* Loading state */}
        {isAuthed && query.isPending && (
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
              Finding the journey…
            </div>
          </Reveal>
        )}

        {/* Error state */}
        {isAuthed && query.isError && (
          <Reveal>
            <div
              style={{
                padding: theme.space.loose,
                borderRadius: theme.radius.lg,
                background: 'rgba(184, 58, 46, 0.08)',
                border: `1px solid rgba(184, 58, 46, 0.3)`,
                fontFamily: theme.font.display,
                fontSize: 20,
                lineHeight: 1.5,
                color: ink.base,
              }}
            >
              Couldn&apos;t open this journey. It may have been archived or never existed.
              <div style={{ marginTop: theme.space.comfy }}>
                <Link
                  href="/aether/destinations"
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.body.size,
                    fontWeight: 600,
                    color: accent.deep,
                    textDecoration: 'none',
                  }}
                >
                  Browse destinations →
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Trip rendered */}
        {trip !== undefined && (
          <>
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
                Your journey · {trip.status}
              </p>
              <h1
                style={{
                  fontFamily: theme.font.display,
                  fontSize: 'clamp(40px, 6vw, 88px)',
                  lineHeight: 1.0,
                  letterSpacing: '-0.026em',
                  fontWeight: 600,
                  margin: 0,
                  color: ink.base,
                }}
              >
                {trip.title}
              </h1>
              {trip.archivedAt !== null && (
                <p
                  style={{
                    marginTop: theme.space.comfy,
                    display: 'inline-block',
                    padding: `4px 12px`,
                    borderRadius: theme.radius.pill,
                    background: ochre.whisper,
                    color: ink.base,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Archived · {fmtDate(trip.archivedAt)}
                </p>
              )}
            </Reveal>

            {/* "Add to trip" staging banner — set by destination pages
                that link here with ?addPlace=. Phase 0 stub: explains
                the place is queued; the real append-place endpoint is
                Phase 1. Open-in-planner takes the user to the live
                editor where they can drop the pin. */}
            {addPlace !== null && addPlace !== '' && (
              <Reveal>
                <div
                  style={{
                    marginTop: theme.space.gutter,
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: ochre.whisper,
                    border: `1px solid ${ochre.deep}`,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: theme.space.comfy,
                    alignItems: 'center',
                    justifyContent: 'space-between',
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
                      Adding to your trip
                    </p>
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 'clamp(20px, 2.4vw, 28px)',
                        lineHeight: 1.2,
                        letterSpacing: '-0.014em',
                        fontWeight: 600,
                        margin: `${theme.space.hairline}px 0 0`,
                        color: ink.base,
                      }}
                    >
                      {addPlace}
                    </p>
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 15,
                        lineHeight: 1.5,
                        color: ink.soft,
                        margin: `${theme.space.tight}px 0 0`,
                        maxWidth: '46ch',
                      }}
                    >
                      Open this trip in the planner to drop the pin and let the model fit it into
                      the days.
                    </p>
                  </div>
                  <Link
                    href={`/trips/${tripId}`}
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
                    Open the planner
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </Reveal>
            )}

            {/* Facts strip */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  border: `1px solid ${ink.whisper}`,
                  borderRadius: theme.radius.lg,
                  background: surface.soft,
                  overflow: 'hidden',
                }}
              >
                {[
                  {
                    label: 'Range',
                    value:
                      trip.startsOn !== null && trip.endsOn !== null
                        ? `${fmtDate(trip.startsOn)} – ${fmtDate(trip.endsOn)}`
                        : '—',
                  },
                  {
                    label: 'Days',
                    value:
                      daysBetween(trip.startsOn, trip.endsOn) !== null
                        ? String((daysBetween(trip.startsOn, trip.endsOn) ?? 0) + 1)
                        : '—',
                  },
                  { label: 'Radius', value: `${trip.radiusKm}km` },
                  { label: 'Drafted', value: fmtDate(trip.createdAt) },
                ].map((f, idx) => (
                  <div
                    key={f.label}
                    style={{
                      padding: `${theme.space.loose}px ${theme.space.comfy}px`,
                      borderLeft: idx > 0 ? `1px solid ${ink.whisper}` : 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: theme.font.ui,
                        fontSize: 11,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: ink.soft,
                        fontWeight: 600,
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontFamily: theme.font.display,
                        fontSize: 'clamp(18px, 1.8vw, 22px)',
                        lineHeight: 1.25,
                        letterSpacing: '-0.012em',
                        fontWeight: 600,
                        color: ink.base,
                        marginTop: 6,
                      }}
                    >
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Action row — archive/unarchive. Aether keeps these small;
                destructive style only on the archive direction. */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: theme.space.tight,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: ink.soft,
                    fontWeight: 600,
                    marginRight: theme.space.tight,
                  }}
                >
                  Actions
                </span>
                {trip.archivedAt === null ? (
                  <button
                    type="button"
                    onClick={() => archiveMutation.mutate({ id: trip.id })}
                    disabled={archiveMutation.isPending}
                    style={{
                      padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                      borderRadius: theme.radius.pill,
                      background: 'transparent',
                      border: `1px solid ${ink.whisper}`,
                      color: ink.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      fontWeight: 600,
                      cursor: archiveMutation.isPending ? 'wait' : 'pointer',
                      opacity: archiveMutation.isPending ? 0.6 : 1,
                      transition: 'background 220ms, border-color 220ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!archiveMutation.isPending) {
                        e.currentTarget.style.background = 'rgba(184, 58, 46, 0.06)';
                        e.currentTarget.style.borderColor = 'rgba(184, 58, 46, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = ink.whisper;
                    }}
                  >
                    {archiveMutation.isPending ? 'Archiving…' : 'Archive journey'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => unarchiveMutation.mutate({ id: trip.id })}
                    disabled={unarchiveMutation.isPending}
                    style={{
                      padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                      borderRadius: theme.radius.pill,
                      background: olive.whisper,
                      border: `1px solid ${olive.deep}`,
                      color: ink.base,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      fontWeight: 600,
                      cursor: unarchiveMutation.isPending ? 'wait' : 'pointer',
                      opacity: unarchiveMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {unarchiveMutation.isPending ? 'Restoring…' : 'Unarchive · restore'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => duplicateMutation.mutate({ id: trip.id })}
                  disabled={duplicateMutation.isPending}
                  style={{
                    padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${ochre.deep}`,
                    color: ochre.deep,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    fontWeight: 600,
                    cursor: duplicateMutation.isPending ? 'wait' : 'pointer',
                    opacity: duplicateMutation.isPending ? 0.6 : 1,
                    transition: 'background 220ms, color 220ms',
                  }}
                  onMouseEnter={(e) => {
                    if (!duplicateMutation.isPending) {
                      e.currentTarget.style.background = ochre.whisper;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {duplicateMutation.isPending ? 'Duplicating…' : 'Duplicate journey'}
                </button>
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  disabled={exportingPdf}
                  style={{
                    padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${olive.deep}`,
                    color: olive.deep,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    fontWeight: 600,
                    cursor: exportingPdf ? 'wait' : 'pointer',
                    opacity: exportingPdf ? 0.6 : 1,
                  }}
                  aria-label="Download this journey as a PDF"
                >
                  {exportingPdf ? 'Composing…' : 'Export PDF'}
                </button>
                <Link
                  href="/aether/me/journeys"
                  style={{
                    padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${ink.whisper}`,
                    color: ink.soft,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  ← All journeys
                </Link>
              </div>
              {duplicateError !== null && (
                <p
                  role="alert"
                  style={{
                    marginTop: theme.space.tight,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    color: '#8a2418',
                  }}
                >
                  {duplicateError}
                </p>
              )}
              {exportError !== null && (
                <p
                  role="alert"
                  style={{
                    marginTop: theme.space.tight,
                    fontFamily: theme.font.ui,
                    fontSize: theme.text.small.size,
                    color: '#8a2418',
                  }}
                >
                  {exportError}
                </p>
              )}
            </Reveal>

            {/* Share band — creates a /shared/[code] link via POST
                /trips/[id]/share. Auth still required to read; recipients
                hit the public shared route. */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.gutter,
                  padding: theme.space.loose,
                  borderRadius: theme.radius.lg,
                  background: ochre.whisper,
                  border: `1px solid ${ochre.deep}`,
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
                  Share this journey
                </p>
                {shareUrl === null ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: theme.space.comfy,
                      flexWrap: 'wrap',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: theme.font.display,
                        fontStyle: 'italic',
                        fontSize: 17,
                        lineHeight: 1.5,
                        color: ink.soft,
                        margin: 0,
                        maxWidth: '40ch',
                      }}
                    >
                      Anyone with the link will be able to read this journey — they can&apos;t edit
                      it, only see the shape.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        shareMutation.mutate({
                          id: trip.id,
                          data: {},
                        })
                      }
                      disabled={shareMutation.isPending}
                      style={{
                        padding: `${theme.space.tight}px ${theme.space.loose}px`,
                        borderRadius: theme.radius.pill,
                        background: accent.base,
                        color: surface.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.button.size,
                        fontWeight: theme.text.button.weight,
                        border: 'none',
                        cursor: shareMutation.isPending ? 'wait' : 'pointer',
                        opacity: shareMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {shareMutation.isPending ? 'Creating…' : 'Create link →'}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.space.tight,
                      flexWrap: 'wrap',
                    }}
                  >
                    <code
                      style={{
                        flex: '1 1 280px',
                        padding: `${theme.space.tight}px ${theme.space.inline}px`,
                        borderRadius: theme.radius.md,
                        background: surface.base,
                        border: `1px solid ${ink.whisper}`,
                        fontFamily: theme.font.mono,
                        fontSize: 12,
                        color: ink.base,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shareUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          void navigator.clipboard.writeText(shareUrl).then(() => {
                            setShareCopied(true);
                            window.setTimeout(() => setShareCopied(false), 2000);
                          });
                        }
                      }}
                      style={{
                        padding: `${theme.space.tight}px ${theme.space.comfy}px`,
                        borderRadius: theme.radius.pill,
                        background: shareCopied ? olive.deep : ink.base,
                        color: surface.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.small.size,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 220ms',
                      }}
                    >
                      {shareCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                {shareError !== null && (
                  <p
                    role="alert"
                    style={{
                      marginTop: theme.space.tight,
                      fontFamily: theme.font.ui,
                      fontSize: theme.text.small.size,
                      color: '#8a2418',
                    }}
                  >
                    {shareError}
                  </p>
                )}
                {/* AE79 — share card toggle */}
                <button
                  type="button"
                  onClick={() => setShowShareCard((v) => !v)}
                  style={{
                    marginTop: theme.space.tight,
                    padding: `${theme.space.hairline}px ${theme.space.comfy}px`,
                    borderRadius: theme.radius.pill,
                    background: 'transparent',
                    border: `1px solid ${ochre.deep}`,
                    color: ochre.deep,
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                  aria-expanded={showShareCard}
                >
                  {showShareCard ? 'Hide share card ▴' : 'Show share card ▾'}
                </button>
              </div>
            </Reveal>

            {showShareCard && (
              <Reveal>
                <div style={{ marginTop: theme.space.gutter }}>
                  <TripShareCard trip={trip} />
                </div>
              </Reveal>
            )}

            {/* Itinerary — real days when present, calm stub otherwise. */}
            {hasItinerary ? (
              <Reveal>
                <div style={{ marginTop: theme.space.hero }}>
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: accent.deep,
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    Day by day · {days.length} {days.length === 1 ? 'day' : 'days'}
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(28px, 3.4vw, 44px)',
                      lineHeight: 1.1,
                      letterSpacing: '-0.018em',
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.gutter,
                      color: ink.base,
                    }}
                  >
                    The shape of your yatra.
                  </h2>
                  <ol
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: theme.space.comfy,
                    }}
                  >
                    {days.map((day) => {
                      const dayNumber = day.dayIndex + 1;
                      const title = readSummaryField(day.summary, 'title');
                      const subtitle =
                        readSummaryField(day.summary, 'subtitle') ??
                        readSummaryField(day.summary, 'theme');
                      const note = readSummaryField(day.summary, 'note');
                      const items = [...day.items].sort(
                        (a: ItineraryItemDto, b: ItineraryItemDto) => a.position - b.position,
                      );
                      return (
                        <li
                          key={day.id}
                          style={{
                            padding: theme.space.loose,
                            borderRadius: theme.radius.lg,
                            background: surface.soft,
                            border: `1px solid ${olive.whisper}`,
                            display: 'grid',
                            gridTemplateColumns: isNarrow ? '1fr' : '88px 1fr',
                            gap: theme.space.comfy,
                          }}
                        >
                          {/* Numeral cap — display-serif, terracotta */}
                          <div
                            style={{
                              fontFamily: theme.font.display,
                              fontSize: isNarrow ? 28 : 56,
                              lineHeight: 1,
                              letterSpacing: '-0.02em',
                              fontWeight: 600,
                              color: accent.deep,
                              textAlign: isNarrow ? 'left' : 'right',
                            }}
                          >
                            {String(dayNumber).padStart(2, '0')}
                          </div>
                          <div>
                            <p
                              style={{
                                fontFamily: theme.font.ui,
                                fontSize: 11,
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                                color: ink.soft,
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              Day {dayNumber} · {fmtDayHead(day.date)}
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
                              {title ?? 'A quiet day in the journey.'}
                            </h3>
                            {subtitle !== null && (
                              <p
                                style={{
                                  fontFamily: theme.font.display,
                                  fontStyle: 'italic',
                                  fontSize: 17,
                                  lineHeight: 1.5,
                                  color: ink.soft,
                                  margin: `${theme.space.tight}px 0 0`,
                                }}
                              >
                                {subtitle}
                              </p>
                            )}
                            {items.length > 0 && (
                              <ul
                                style={{
                                  listStyle: 'none',
                                  padding: 0,
                                  margin: `${theme.space.comfy}px 0 0`,
                                  display: 'grid',
                                  gap: theme.space.hairline,
                                }}
                              >
                                {items.map((item) => {
                                  const start = fmtTime(item.startTime);
                                  const end = fmtTime(item.endTime);
                                  const noteText = asIso(item.notes);
                                  const done = asIso(item.completedAt) !== null;
                                  return (
                                    <li
                                      key={item.id}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: '76px 1fr',
                                        gap: theme.space.tight,
                                        fontFamily: theme.font.ui,
                                        fontSize: theme.text.body.size,
                                        lineHeight: 1.5,
                                        color: done ? ink.soft : ink.base,
                                        textDecoration: done ? 'line-through' : 'none',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontFamily: theme.font.mono,
                                          fontSize: 11,
                                          letterSpacing: '0.06em',
                                          color: ink.soft,
                                          paddingTop: 2,
                                        }}
                                      >
                                        {start ?? '—'}
                                        {end !== null && start !== null ? ` · ${end}` : ''}
                                      </span>
                                      <span>{noteText ?? 'Movement, with no script.'}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {note !== null && (
                              <p
                                style={{
                                  fontFamily: theme.font.display,
                                  fontStyle: 'italic',
                                  fontSize: 15,
                                  lineHeight: 1.55,
                                  color: ink.soft,
                                  margin: `${theme.space.comfy}px 0 0`,
                                  paddingLeft: theme.space.comfy,
                                  borderLeft: `2px solid ${ochre.deep}`,
                                }}
                              >
                                {note}
                              </p>
                            )}
                            {items.length === 0 && (
                              <p
                                style={{
                                  fontFamily: theme.font.display,
                                  fontStyle: 'italic',
                                  fontSize: 15,
                                  lineHeight: 1.55,
                                  color: ink.soft,
                                  margin: `${theme.space.tight}px 0 0`,
                                }}
                              >
                                A pause day. Open in the planner to fill it in.
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <div
                    style={{
                      marginTop: theme.space.gutter,
                      display: 'flex',
                      gap: theme.space.tight,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Link
                      href={`/trips/${tripId}`}
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
                        boxShadow: theme.elevation.raised.shadow,
                      }}
                    >
                      Edit in the planner
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </div>
              </Reveal>
            ) : (
              <Reveal>
                <div
                  style={{
                    marginTop: theme.space.hero,
                    padding: theme.space.loose,
                    borderRadius: theme.radius.lg,
                    background: surface.soft,
                    border: `1px dashed ${olive.deep}`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: theme.font.ui,
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: olive.deep,
                      fontWeight: 600,
                      margin: 0,
                      marginBottom: theme.space.tight,
                    }}
                  >
                    {itineraryQuery.isPending
                      ? 'Day-by-day · gathering'
                      : 'Day-by-day · coming next'}
                  </p>
                  <h2
                    style={{
                      fontFamily: theme.font.display,
                      fontSize: 'clamp(22px, 2.6vw, 32px)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.014em',
                      fontWeight: 600,
                      margin: 0,
                      color: ink.base,
                    }}
                  >
                    {itineraryQuery.isPending
                      ? 'Reading the days…'
                      : 'The intelligence is preparing your itinerary.'}
                  </h2>
                  <p
                    style={{
                      fontFamily: theme.font.display,
                      fontStyle: 'italic',
                      fontSize: 17,
                      lineHeight: 1.55,
                      color: ink.soft,
                      margin: `${theme.space.tight}px 0 ${theme.space.comfy}px`,
                    }}
                  >
                    Open this journey in the full planner to read the day-by-day, swap places,
                    adjust pace, or add a host. The Aether dashboard shows the shape — the planner
                    does the edit.
                  </p>
                  <div style={{ display: 'flex', gap: theme.space.tight, flexWrap: 'wrap' }}>
                    <Link
                      href={`/trips/${tripId}`}
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
                        boxShadow: theme.elevation.raised.shadow,
                      }}
                    >
                      Open in the planner
                      <span aria-hidden>→</span>
                    </Link>
                    <Link
                      href="/aether/plan"
                      style={{
                        padding: `${theme.space.tight}px ${theme.space.loose}px`,
                        borderRadius: theme.radius.pill,
                        background: 'transparent',
                        color: ink.base,
                        fontFamily: theme.font.ui,
                        fontSize: theme.text.button.size,
                        fontWeight: theme.text.button.weight,
                        textDecoration: 'none',
                        border: `1px solid ${ink.whisper}`,
                      }}
                    >
                      Sketch another
                    </Link>
                  </div>
                </div>
              </Reveal>
            )}

            {/* AE77 — Activity timeline.
                Derived purely from TripDto fields (no extra endpoint).
                Each event is a {at, label, kind} tuple sorted ascending. */}
            <Reveal>
              <div style={{ marginTop: theme.space.hero }}>
                <p
                  style={{
                    fontFamily: theme.font.ui,
                    fontSize: 11,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: ochre.deep,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: theme.space.tight,
                  }}
                >
                  This journey&apos;s life so far
                </p>
                <ol
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    position: 'relative',
                    paddingLeft: 22,
                    borderLeft: `2px solid ${olive.whisper}`,
                  }}
                >
                  {(() => {
                    interface Evt {
                      readonly at: string;
                      readonly label: string;
                      readonly kind: 'create' | 'edit' | 'archive';
                    }
                    const events: Evt[] = [];
                    if (asIso(trip.createdAt) !== null) {
                      events.push({
                        at: trip.createdAt as unknown as string,
                        label: 'Drafted',
                        kind: 'create',
                      });
                    }
                    if (
                      asIso(trip.updatedAt) !== null &&
                      asIso(trip.updatedAt) !== asIso(trip.createdAt)
                    ) {
                      events.push({
                        at: trip.updatedAt as unknown as string,
                        label: `Edited — version ${trip.version}`,
                        kind: 'edit',
                      });
                    }
                    const archivedAt = asIso(trip.archivedAt);
                    if (archivedAt !== null) {
                      events.push({ at: archivedAt, label: 'Archived', kind: 'archive' });
                    }
                    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
                    return events.map((e) => (
                      <li
                        key={`${e.kind}-${e.at}`}
                        style={{ position: 'relative', padding: `0 0 ${theme.space.comfy}px 0` }}
                      >
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: -29,
                            top: 4,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background:
                              e.kind === 'archive'
                                ? ochre.deep
                                : e.kind === 'edit'
                                  ? olive.deep
                                  : accent.deep,
                            boxShadow: `0 0 0 4px ${surface.base}`,
                          }}
                        />
                        <div
                          style={{
                            fontFamily: theme.font.display,
                            fontSize: 18,
                            fontWeight: 600,
                            color: ink.base,
                            lineHeight: 1.2,
                          }}
                        >
                          {e.label}
                        </div>
                        <div
                          style={{
                            fontFamily: theme.font.mono,
                            fontSize: 11,
                            color: ink.soft,
                            letterSpacing: '0.08em',
                            marginTop: 2,
                          }}
                        >
                          {fmtDate(e.at)}
                        </div>
                      </li>
                    ));
                  })()}
                </ol>
              </div>
            </Reveal>

            {/* Footer meta */}
            <Reveal>
              <div
                style={{
                  marginTop: theme.space.hero,
                  paddingTop: theme.space.gutter,
                  borderTop: `1px solid ${olive.whisper}`,
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: theme.space.comfy,
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  color: ink.soft,
                  opacity: 0.6,
                }}
              >
                <span>trip id · {tripId}</span>
                <span>
                  last edited · {fmtDate(trip.updatedAt)} · version {trip.version}
                </span>
              </div>
            </Reveal>
          </>
        )}
      </section>

      <EditorialFooter />
    </div>
  );
}
