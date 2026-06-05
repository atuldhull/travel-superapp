/**
 * Vitest jsdom spec for <TripShareCard/> (AE98).
 *
 * Asserts:
 *   - the preview SVG renders inline with the trip title
 *   - the Download SVG button is present + accessibly labelled
 *   - the structural ShareCardTrip prop (id, title, radiusKm,
 *     startsOn, endsOn) is enough to render — no TripDto field
 *     required
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AetherProvider } from '@app/aether-core';
import { theme } from '@app/aether-motion';
import {
  TripShareCard,
  type ShareCardTrip,
} from '../../src/components/aether/journey/trip-share-card';

const tripFixture: ShareCardTrip = {
  id: 'beefcafe-1111-2222-3333-444455556666',
  title: 'Three days in Jaipur',
  radiusKm: 50,
  startsOn: null,
  endsOn: null,
  status: 'draft',
};

function renderCard(trip: ShareCardTrip = tripFixture): void {
  render(
    <AetherProvider premiumTier={null} audioOptOut={false} theme={theme}>
      <TripShareCard trip={trip} />
    </AetherProvider>,
  );
}

describe('<TripShareCard/>', () => {
  it('renders the section eyebrow and the Download button', () => {
    renderCard();
    // The eyebrow text describes the artifact.
    expect(screen.getByText(/share card.*1200/i)).toBeInTheDocument();
    // The download button.
    expect(screen.getByRole('button', { name: /download share card svg/i })).toBeInTheDocument();
  });

  it('embeds the trip title inside the inline SVG preview', () => {
    renderCard();
    // The preview SVG is rendered via dangerouslySetInnerHTML inside a
    // sibling div; verify by querying the document for any SVG that
    // contains the title string.
    const svgs = document.querySelectorAll('svg');
    const matched = Array.from(svgs).some((s) =>
      (s.textContent ?? '').includes('Three days in Jaipur'),
    );
    expect(matched).toBe(true);
  });

  it('accepts a SharedTripDto-shape (no status field)', () => {
    const sharedShape: ShareCardTrip = {
      id: 'cafe1234',
      title: 'A shared journey',
      radiusKm: 30,
      startsOn: null,
      endsOn: null,
      // status omitted on purpose
    };
    renderCard(sharedShape);
    expect(screen.getByText(/share card/i)).toBeInTheDocument();
  });

  it('clicking Download triggers URL.createObjectURL via the blob path', () => {
    // Mock URL.createObjectURL to capture the call and assert.
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:mock');
    const revokeMock = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectUrlMock as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeMock as unknown as typeof URL.revokeObjectURL;

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: /download share card svg/i }));
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(createObjectUrlMock.mock.calls[0]?.[0]).toBeInstanceOf(Blob);

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });
});
