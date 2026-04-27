/**
 * V.UX.5 frequent-business-traveler. "Export PDF" button on
 * `/trips/:id` that fetches the trip's metadata + itinerary client-
 * side and renders a 1-2 page PDF via `@react-pdf/renderer`. Triggers
 * a browser download — no server round-trip.
 *
 * Why client-side render: keeps the api stateless + avoids a Puppeteer
 * dep on the backend. Renderer is loaded dynamically so the heavy
 * pdf bundle isn't in the trip-page main chunk.
 *
 * Installed by prompt [V.UX.5].
 */
'use client';

import { useState } from 'react';
import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type TripDto,
} from '@app/sdk';
import { Button } from '../ui/button';

interface ExportPdfButtonProps {
  readonly tripId: string;
  readonly tripTitle: string;
}

export function ExportPdfButton({ tripId, tripTitle }: ExportPdfButtonProps) {
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Both queries are auto-enabled because they're already mounted by
  // the parent `TripDetailPage` — the same key returns cached data.
  const { data: tripData } = useTripControllerGetOne(tripId);
  const { data: itinData } = useTripControllerGetItinerary(tripId);

  async function exportPdf() {
    setBusy(true);
    setErrMsg(null);
    try {
      const trip = tripData?.data as unknown as TripDto | undefined;
      const itin = itinData?.data as unknown as ItineraryListResponseDto | undefined;
      if (!trip) {
        setErrMsg('Trip not loaded yet — wait a moment and try again.');
        return;
      }
      // Lazy-load the renderer + the document component so the PDF
      // bundle isn't in the trip-page initial chunk.
      const [{ pdf }, { TripPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./trip-pdf-document'),
      ]);
      const days: readonly ItineraryDayDto[] = itin?.days ?? [];
      const blob = await pdf(<TripPdfDocument trip={trip} days={days} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(tripTitle)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const e = err as Error;
      setErrMsg(`Export failed: ${e.message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={exportPdf} disabled={busy}>
        {busy ? 'Exporting…' : '📄 Export PDF'}
      </Button>
      {errMsg ? (
        <span className="ml-2 text-xs text-danger" role="status">
          {errMsg}
        </span>
      ) : null}
    </>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'trip'
  );
}
