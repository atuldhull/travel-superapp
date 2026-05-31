/** Vitest specs for AE393 — DriftNowCard reads UpcomingTripProvider. */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DriftNowCard } from '../../src/components/aether/phase1/drift-now-card';
import { UpcomingTripProvider } from '../../src/components/aether/phase1/upcoming-trip-context';
import type { UpcomingTripLike } from '../../src/components/aether/phase1/upcoming-trip';

// Local-time constructor so getHours() returns 10 (morning band) on
// every host timezone (vs `2026-06-15T10:00:00Z` which is afternoon in
// IST / evening in JST etc.).
const MORNING = new Date(2026, 5, 15, 10, 0, 0);

describe('<DriftNowCard/> — AE393 persona content', () => {
  it('falls back to AE385 baseline when no upcoming trip in context', () => {
    render(<DriftNowCard at={MORNING} disableLifecycle />);
    expect(screen.queryByText('Morning')).not.toBeNull();
    expect(screen.queryByText('Sketch the day ahead.')).not.toBeNull();
  });

  it('shows "Trip day" + the title when trip starts today', () => {
    const trip: UpcomingTripLike = {
      id: 't1',
      title: 'Leh sprint',
      startsOn: '2026-06-15T23:00:00Z',
      archivedAt: null,
    };
    render(
      <UpcomingTripProvider trip={trip}>
        <DriftNowCard at={MORNING} disableLifecycle />
      </UpcomingTripProvider>,
    );
    expect(screen.queryByText('Trip day')).not.toBeNull();
    expect(screen.queryByText('Leh sprint starts today.')).not.toBeNull();
    expect(screen.queryByText('Open')).not.toBeNull();
  });

  it('shows "<N> day(s) until <title>" inside the 7-day window', () => {
    const trip: UpcomingTripLike = {
      id: 't1',
      title: 'Goa weekend',
      startsOn: '2026-06-18T10:00:00Z',
      archivedAt: null,
    };
    render(
      <UpcomingTripProvider trip={trip}>
        <DriftNowCard at={MORNING} disableLifecycle />
      </UpcomingTripProvider>,
    );
    expect(screen.queryByText('3 days until Goa weekend')).not.toBeNull();
    expect(screen.queryByText('Sketch the day-1 itinerary.')).not.toBeNull();
  });

  it('shows polish prompt 8..30 days out', () => {
    const trip: UpcomingTripLike = {
      id: 't1',
      title: 'Jaipur',
      startsOn: '2026-06-30T10:00:00Z',
      archivedAt: null,
    };
    render(
      <UpcomingTripProvider trip={trip}>
        <DriftNowCard at={MORNING} disableLifecycle />
      </UpcomingTripProvider>,
    );
    expect(screen.queryByText('15 days until Jaipur')).not.toBeNull();
    expect(screen.queryByText('Polish the plan.')).not.toBeNull();
  });

  it('falls back to baseline for trips >30 days out', () => {
    const trip: UpcomingTripLike = {
      id: 't1',
      title: 'August Big',
      startsOn: '2026-08-01T10:00:00Z',
      archivedAt: null,
    };
    render(
      <UpcomingTripProvider trip={trip}>
        <DriftNowCard at={MORNING} disableLifecycle />
      </UpcomingTripProvider>,
    );
    expect(screen.queryByText('Morning')).not.toBeNull();
    expect(screen.queryByText(/August Big/)).toBeNull();
  });
});
