/** Vitest specs for AE434 `<LiveTripWatchOverlay/>` — jsdom integration. */
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LiveTripWatchOverlay } from '../../src/components/aether/phase3/live-trip-watch-overlay';
import type { LiveTripPresence } from '../../src/components/aether/phase3/live-trip-watch';

const LIVE_FRAME: LiveTripPresence = {
  tripId: 'trip-leh-2026-06',
  lat: 34.1526,
  lng: 77.5771,
  speedKmH: 12,
  reportedAt: new Date(Date.now() - 5_000).toISOString(),
  mode: 'walking',
};

const RECENT_FRAME: LiveTripPresence = {
  ...LIVE_FRAME,
  reportedAt: new Date(Date.now() - 90_000).toISOString(),
};

const STALE_FRAME: LiveTripPresence = {
  ...LIVE_FRAME,
  reportedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
};

describe('<LiveTripWatchOverlay/> integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when tripId is empty', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="" />);
    expect(container.querySelector('[data-aether-live-trip-watch]')).toBeNull();
  });

  it('renders an aside marked data-aether-live-trip-watch when tripId is supplied', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={LIVE_FRAME} />);
    expect(container.querySelector('[data-aether-live-trip-watch]')).not.toBeNull();
  });

  it('tags the tier data-attribute with "live" for fresh frames', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={LIVE_FRAME} />);
    const aside = container.querySelector('[data-aether-live-trip-watch]');
    expect(aside?.getAttribute('data-aether-live-trip-tier')).toBe('live');
  });

  it('tags the tier data-attribute with "recent" for older frames', () => {
    const { container } = render(
      <LiveTripWatchOverlay tripId="trip-leh" presence={RECENT_FRAME} />,
    );
    const aside = container.querySelector('[data-aether-live-trip-watch]');
    expect(aside?.getAttribute('data-aether-live-trip-tier')).toBe('recent');
  });

  it('returns null when the frame is past the stale threshold', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={STALE_FRAME} />);
    expect(container.querySelector('[data-aether-live-trip-watch]')).toBeNull();
  });

  it('renders the freshness label in the live row', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={LIVE_FRAME} />);
    const label = container.querySelector('[data-aether-live-trip-freshness]');
    expect(label?.textContent?.toLowerCase()).toContain('live');
  });

  it('renders the mode + speed meta row', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={LIVE_FRAME} />);
    expect(container.querySelector('[data-aether-live-trip-mode]')?.textContent).toBe('walking');
    expect(container.querySelector('[data-aether-live-trip-speed]')?.textContent).toBe('12 km/h');
  });

  it('falls back to a synthesised dev fixture when presence is omitted', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-fallback" />);
    const aside = container.querySelector('[data-aether-live-trip-watch]');
    expect(aside).not.toBeNull();
    // Synthesised mode = walking.
    expect(container.querySelector('[data-aether-live-trip-mode]')?.textContent).toBe('walking');
  });

  it('em-dash speed label when speedKmH is null', () => {
    const noSpeed: LiveTripPresence = { ...LIVE_FRAME, speedKmH: null };
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={noSpeed} />);
    expect(container.querySelector('[data-aether-live-trip-speed]')?.textContent).toContain('—');
  });

  it('aria-live announcer carries the full presence summary', () => {
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={LIVE_FRAME} />);
    const aria = container.querySelector('[data-aether-live-trip-aria]');
    expect(aria?.textContent?.toLowerCase()).toContain('walking');
    expect(aria?.textContent).toContain('12 km/h');
  });

  it('explicit null presence still renders an overlay (frame becomes null tier=stale → hidden)', () => {
    // When presence is explicitly null, the fixture fallback is skipped
    // (per overlay logic: only undefined triggers synth). Stale gate hides.
    const { container } = render(<LiveTripWatchOverlay tripId="trip-leh" presence={null} />);
    // tier === 'stale' AND frame === null => the overlay still renders
    // (the gate only hides when `tier === 'stale' && frame !== null`).
    expect(container.querySelector('[data-aether-live-trip-watch]')).not.toBeNull();
    expect(container.querySelector('[data-aether-live-trip-mode]')?.textContent).toBe('unknown');
  });
});
