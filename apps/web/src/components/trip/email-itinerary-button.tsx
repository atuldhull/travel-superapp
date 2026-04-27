/**
 * V.UX.5 frequent-business-traveler. "Email itinerary" button on
 * `/trips/:id` that opens the user's mail client with a pre-filled
 * subject + plain-text body summarizing the trip + days + items.
 *
 * Uses `mailto:` (no provider integration); the user picks their own
 * client. The body is URL-encoded so newlines + emoji survive.
 *
 * Installed by prompt [V.UX.5].
 */
'use client';

import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryDayDto,
  type ItineraryListResponseDto,
  type TripDto,
} from '@app/sdk';
import { Button } from '../ui/button';

interface EmailItineraryButtonProps {
  readonly tripId: string;
  readonly tripTitle: string;
}

export function EmailItineraryButton({ tripId, tripTitle }: EmailItineraryButtonProps) {
  const { data: tripData } = useTripControllerGetOne(tripId);
  const { data: itinData } = useTripControllerGetItinerary(tripId);

  function buildAndOpen() {
    const trip = tripData?.data as unknown as TripDto | undefined;
    const itin = itinData?.data as unknown as ItineraryListResponseDto | undefined;
    const days: readonly ItineraryDayDto[] = itin?.days ?? [];
    const subject = `Trip plan: ${tripTitle}`;
    const body = composeBody(trip, days);
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Browser handles handoff to the user's mail client.
    window.location.href = href;
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={buildAndOpen}>
      ✉️ Email
    </Button>
  );
}

function composeBody(trip: TripDto | undefined, days: readonly ItineraryDayDto[]): string {
  const parts: string[] = [];
  if (trip) {
    const startsOn = trip.startsOn ? new Date(trip.startsOn as unknown as string) : null;
    const endsOn = trip.endsOn ? new Date(trip.endsOn as unknown as string) : null;
    parts.push(trip.title);
    if (startsOn && endsOn) {
      parts.push(`${startsOn.toLocaleDateString()} → ${endsOn.toLocaleDateString()}`);
    }
    parts.push(`${trip.radiusKm}km radius · status: ${trip.status}`);
    parts.push('');
  }
  if (days.length === 0) {
    parts.push('(no itinerary yet)');
  } else {
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      const date = new Date(d.date as unknown as string).toLocaleDateString();
      parts.push(`Day ${i + 1} — ${date}`);
      const summary = d.summary as unknown as string | null;
      if (summary) parts.push(`  ${summary}`);
      if (d.items.length === 0) {
        parts.push('  (no items)');
      } else {
        for (const it of d.items) {
          const note = (it.notes as unknown as string | null) ?? '(no notes)';
          parts.push(`  • ${note}`);
        }
      }
      parts.push('');
    }
  }
  parts.push('—');
  parts.push('Sent from Travel Super App');
  return parts.join('\n');
}
