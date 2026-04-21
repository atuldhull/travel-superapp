/**
 * Deterministic mock events provider. Returns a fixed set of 4
 * events spanning categories + price tiers + distances. Start times
 * are pinned to the window's `from` so tests can assert exact
 * filtering behaviour without clock games.
 *
 * Real adapters (Meetup, Eventbrite public, local city-events
 * scraper) land as sibling classes when credentials + robots policy
 * are sorted.
 *
 * Installed by prompt [IV.18.9.1].
 */
import { Injectable } from '@nestjs/common';
import type { EventListing } from '../domain/event-listing.entity';
import type { EventProvider, SearchEventsInput } from '../application/ports/event-provider';

const PROVIDER = 'mock';

@Injectable()
export class MockEventProvider implements EventProvider {
  async searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]> {
    const fromMs = Date.parse(input.from);
    // Hour offsets from `from` — deterministic, within-window.
    const fixtures: Array<{
      slug: string;
      title: string;
      category: string;
      description: string | null;
      venueName: string | null;
      offsetLat: number;
      offsetLng: number;
      distanceMeters: number;
      startOffsetHours: number;
      durationHours: number;
      currency: string | null;
      priceMin: string | null;
      priceMax: string | null;
      sourceUrl: string | null;
    }> = [
      {
        slug: 'jazz-night',
        title: 'Live Jazz at The Cellar',
        category: 'music',
        description: 'Small-room jazz quartet',
        venueName: 'The Cellar',
        offsetLat: 0.003,
        offsetLng: 0.001,
        distanceMeters: 300,
        startOffsetHours: 4,
        durationHours: 3,
        currency: 'USD',
        priceMin: '15.00',
        priceMax: '25.00',
        sourceUrl: 'https://mock.example/jazz-night',
      },
      {
        slug: 'farmers-market',
        title: 'Saturday Farmers Market',
        category: 'market',
        description: 'Local produce + artisans',
        venueName: 'Town Square',
        offsetLat: 0.008,
        offsetLng: 0.006,
        distanceMeters: 1_000,
        startOffsetHours: 10,
        durationHours: 5,
        currency: null,
        priceMin: null,
        priceMax: null,
        sourceUrl: 'https://mock.example/market',
      },
      {
        slug: 'art-opening',
        title: 'Gallery Opening: Urban Contour',
        category: 'art',
        description: null,
        venueName: 'Contour Gallery',
        offsetLat: 0.018,
        offsetLng: 0.011,
        distanceMeters: 2_200,
        startOffsetHours: 18,
        durationHours: 2,
        currency: 'USD',
        priceMin: '0.00',
        priceMax: '0.00',
        sourceUrl: 'https://mock.example/art-opening',
      },
      {
        slug: 'symphony',
        title: 'City Symphony: Mahler 5',
        category: 'music',
        description: 'Full orchestra, main hall',
        venueName: 'Concert Hall',
        offsetLat: 0.03,
        offsetLng: 0.02,
        distanceMeters: 3_800,
        startOffsetHours: 34,
        durationHours: 2,
        currency: 'USD',
        priceMin: '45.00',
        priceMax: '180.00',
        sourceUrl: 'https://mock.example/symphony',
      },
    ];

    const results: EventListing[] = fixtures.map((f) => {
      const startMs = fromMs + f.startOffsetHours * 3_600_000;
      const endMs = startMs + f.durationHours * 3_600_000;
      return {
        externalId: `${PROVIDER}:${f.slug}-${input.lat.toFixed(3)}-${input.lng.toFixed(3)}`,
        provider: PROVIDER,
        title: f.title,
        description: f.description,
        category: f.category,
        venueName: f.venueName,
        lat: input.lat + f.offsetLat,
        lng: input.lng + f.offsetLng,
        distanceMeters: f.distanceMeters,
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        currency: f.currency,
        priceMin: f.priceMin,
        priceMax: f.priceMax,
        sourceUrl: f.sourceUrl,
      };
    });

    const toMs = Date.parse(input.to);
    return results
      .filter((e) => e.distanceMeters <= input.radiusKm * 1_000)
      .filter((e) => Date.parse(e.startsAt) < toMs) // starts before window ends
      .filter((e) => Date.parse(e.endsAt) > fromMs) // ends after window starts
      .filter((e) => (input.category ? e.category === input.category.toLowerCase() : true))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }
}
