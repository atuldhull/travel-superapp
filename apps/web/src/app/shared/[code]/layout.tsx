/**
 * V.UX.39 — server-side `generateMetadata` for the public shared-trip
 * viewer. Fetches the public trip payload at request time + surfaces
 * title / dates / OG card. The page itself stays 'use client'.
 *
 * The shared-trip route's id is an opaque code, not a DB id — so the
 * api endpoint is `/api/v1/trips/shared/:code`. Owner display name
 * + dates are safe to surface in OG metadata; coords are not in the
 * public DTO so no map-y card.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travelsuperapp.local';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000';

interface SharedTrip {
  readonly title: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly ownerDisplayName?: string | null;
}

function fmtRange(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn && !endsOn) return null;
  if (startsOn && endsOn) {
    return `${startsOn.slice(0, 10)} → ${endsOn.slice(0, 10)}`;
  }
  return startsOn?.slice(0, 10) ?? endsOn?.slice(0, 10) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  let trip: SharedTrip | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/trips/shared/${code}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const body = (await res.json()) as { trip?: SharedTrip };
      trip = body.trip ?? null;
    }
  } catch {
    trip = null;
  }
  const title = trip?.title ?? 'Shared trip';
  const range = trip ? fmtRange(trip.startsOn, trip.endsOn) : null;
  const description =
    [trip?.ownerDisplayName ? `Trip by ${trip.ownerDisplayName}` : null, range]
      .filter(Boolean)
      .join(' · ') || 'A shared trip on TravelSuperApp.';
  const url = `${SITE_URL}/shared/${code}`;
  return {
    title,
    description,
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'TravelSuperApp',
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: url },
  };
}

export default function SharedTripViewerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
