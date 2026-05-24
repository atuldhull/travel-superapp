/**
 * Trip factories ([I1]).
 *
 * Returns the PAYLOAD shape — `makeTripPayload()` — and the
 * over-HTTP helper — `createTrip()` — separately so domain unit
 * tests can use the payload without booting a Nest app.
 *
 * Installed by prompt [I1].
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uniqueName, uniqueSuffix } from './index';

export interface MakeTripPayloadOptions {
  readonly prefix: string;
  readonly title?: string;
  readonly destination?: string;
  readonly radiusKm?: number;
  readonly startsOn?: string | null;
  readonly endsOn?: string | null;
}

export interface CreateTripPayload {
  readonly title: string;
  readonly destination: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

/** Returns a trip-create payload. Provide a `prefix` so cleanup
 *  `where: startsWith(prefix)` queries can find the test row later. */
export function makeTripPayload(opts: MakeTripPayloadOptions): CreateTripPayload {
  return {
    title: opts.title ?? uniqueName(opts.prefix),
    destination: opts.destination ?? `dest-${uniqueSuffix()}`,
    radiusKm: opts.radiusKm ?? 5,
    startsOn: opts.startsOn ?? null,
    endsOn: opts.endsOn ?? null,
  };
}

export interface CreatedTrip {
  readonly tripId: string;
  readonly payload: CreateTripPayload;
}

/** POST a trip-create payload over HTTP, return the new id. */
export async function createTrip(
  app: NestFastifyApplication,
  accessToken: string,
  opts: MakeTripPayloadOptions,
): Promise<CreatedTrip> {
  const payload = makeTripPayload(opts);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/trips',
    headers: { authorization: `Bearer ${accessToken}` },
    payload,
  });
  if (res.statusCode !== 201) {
    throw new Error(
      `createTrip: expected 201, got ${res.statusCode}. Body: ${res.body.slice(0, 200)}`,
    );
  }
  const body = JSON.parse(res.body) as { id: string };
  return { tripId: body.id, payload };
}
