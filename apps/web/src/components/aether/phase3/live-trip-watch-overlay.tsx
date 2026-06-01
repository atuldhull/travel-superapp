'use client';

/**
 * AE425 — `<LiveTripWatchOverlay>` Atlas presence overlay (Tier 4 T4-Ag.2).
 *
 * Per 04-sequencing.md Phase 3 the live trip-watch lands on Atlas as a
 * small floating "Live" badge in the bottom-right (above the Pulse glow)
 * that shows the traveller's current freshness + mode + speed. AE425
 * ships the scaffold + a synthetic frame for visual demo. The real
 * WebTransport receiver lands in AE425b.
 *
 * When `tripId` is empty / the channel hasn't shipped yet, the
 * overlay either shows the AE425 fixture (dev affordance) or stays
 * hidden if `presence` is null and no fixture is supplied.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import {
  presenceAnnouncement,
  presenceDotColor,
  presenceFreshness,
  presenceFreshnessLabel,
  presenceModeGlyph,
  presenceSpeedLabel,
  type LiveTripPresence,
} from './live-trip-watch';

export interface LiveTripWatchOverlayProps {
  /** Active trip id this overlay watches. Empty = no display. */
  readonly tripId: string;
  /** Optional pre-supplied presence frame. AE425b will replace this
   *  with a hook that subscribes to the WebTransport channel. */
  readonly presence?: LiveTripPresence | null;
  /** Refresh tick (ms) for the freshness label. 1 s reads as live
   *  without thrashing the DOM. */
  readonly tickMs?: number;
}

/** AE425 dev fixture so the overlay reads as "live" even without a
 *  real channel. Synthesised relative to Date.now() at mount time so
 *  the freshness label ticks down. */
function synthesizeFixturePresence(tripId: string): LiveTripPresence {
  return {
    tripId,
    lat: 28.6139,
    lng: 77.209,
    speedKmH: 12,
    reportedAt: new Date(Date.now() - 5_000).toISOString(),
    mode: 'walking',
  };
}

export function LiveTripWatchOverlay({
  tripId,
  presence,
  tickMs = 1_000,
}: LiveTripWatchOverlayProps): React.ReactElement | null {
  const [now, setNow] = useState<number>(() => Date.now());
  const [fixture, setFixture] = useState<LiveTripPresence | null>(null);

  // Auto-tick the now value so the freshness label re-renders.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return (): void => window.clearInterval(id);
  }, [tickMs]);

  // When no presence is supplied, fall back to a synthesised dev
  // fixture so the overlay has something to show.
  useEffect(() => {
    if (presence !== undefined) return;
    if (tripId === '') return;
    setFixture(synthesizeFixturePresence(tripId));
  }, [presence, tripId]);

  if (tripId === '') return null;
  const frame = presence ?? fixture;
  const tier = presenceFreshness(frame, now);
  if (tier === 'stale' && frame !== null) return null;

  const style: CSSProperties = {
    position: 'fixed',
    bottom: 100,
    right: 24,
    padding: '10px 14px',
    borderRadius: 14,
    background: 'rgba(20, 12, 8, 0.7)',
    border: `1px solid ${frame === null ? 'rgba(255,255,255,0.18)' : presenceDotColor(tier)}`,
    color: 'var(--aether-palette-surface, #F2E8D5)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    letterSpacing: '0.04em',
    zIndex: 11,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.42)',
    pointerEvents: 'auto',
  };

  return (
    <aside
      data-aether-live-trip-watch
      data-aether-live-trip-tier={tier}
      role="status"
      aria-label="Live trip watch"
      style={style}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: frame === null ? 'transparent' : presenceDotColor(tier),
            boxShadow:
              frame === null || tier !== 'live' ? 'none' : `0 0 8px ${presenceDotColor(tier)}`,
          }}
        />
        <strong
          data-aether-live-trip-freshness
          style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 10 }}
        >
          {presenceFreshnessLabel(frame, now)}
        </strong>
      </div>
      <div
        data-aether-live-trip-meta
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          opacity: tier === 'recent' ? 0.7 : 1,
        }}
      >
        <span data-aether-live-trip-glyph aria-hidden>
          {frame === null ? '·' : presenceModeGlyph(frame.mode)}
        </span>
        <span data-aether-live-trip-mode>{frame?.mode ?? 'unknown'}</span>
        <span data-aether-live-trip-speed style={{ opacity: 0.7 }}>
          {presenceSpeedLabel(frame?.speedKmH ?? null)}
        </span>
      </div>
      <span
        role="status"
        aria-live="polite"
        data-aether-live-trip-aria
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {presenceAnnouncement(frame, now)}
      </span>
    </aside>
  );
}
