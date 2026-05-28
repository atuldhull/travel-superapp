/**
 * Explore tab — near-me discovery.
 *
 * [S-D2] replaces the V.UX.27 web-link stub (three buttons that opened
 * https://travelsuperapp.local/...) with a real near-me surface. Calls
 * `useNearMeControllerNearMe` (V.UX.7 spontaneous-improviser composite)
 * with the device's current geolocation; renders the up-to-5 nearest
 * places with category, distance, walking-route summary, ambient
 * weather, and a one-line safety chip.
 *
 * Geolocation is requested on mount via `useGeolocation`; on denial we
 * fall back to NYC (Times Square) so the screen demos meaningfully on
 * simulators / new installs.
 *
 * Closes the Z1 mobile-audit Explore-10% ship-blocker.
 *
 * Installed by [S-D2] of the S-series real-functionality closeout.
 */
import { ScrollView, RefreshControl } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, H4, Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';
import {
  useNearMeControllerNearMe,
  type NearMeNowResponseDto,
  type NearMePlaceDto,
} from '@app/sdk';
import { DEFAULT_CENTER, useGeolocation } from '../../lib/use-geolocation';
import { useOnlineStatus } from '../../lib/use-online-status';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ExploreScreen() {
  const online = useOnlineStatus();
  const geo = useGeolocation();
  const [body, setBody] = useState<NearMeNowResponseDto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const near = useNearMeControllerNearMe({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        setBody(response.data as NearMeNowResponseDto);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not load near-me.'}`,
        );
      },
    },
  });

  // Re-fetch whenever the device coordinates change (granted / relocate).
  useEffect(() => {
    if (!online) return;
    near.mutate({ data: { center: geo.center, radiusKm: 3 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.center.lat, geo.center.lng, online]);

  const usingFallback =
    geo.status === 'denied' ||
    geo.status === 'unavailable' ||
    (!geo.isReal && geo.center.lat === DEFAULT_CENTER.lat && geo.center.lng === DEFAULT_CENTER.lng);

  const places = useMemo(() => body?.places ?? [], [body]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={near.isPending}
          onRefresh={() => {
            void geo.relocate();
          }}
        />
      }
    >
      <YStack padding="$4" gap="$3">
        <H4>Explore</H4>
        <Paragraph color="$color10">
          Up to 5 nearest places + walking routes + today's weather + a safety chip.
        </Paragraph>

        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Button size="$2" onPress={() => void geo.relocate()}>
            {geo.status === 'pending' ? '📍 Locating…' : '📍 Re-locate'}
          </Button>
          <Text color="$color10" fontSize="$2">
            {geo.center.lat.toFixed(3)}, {geo.center.lng.toFixed(3)}
          </Text>
          {usingFallback ? (
            <Text color="$orange10" fontSize="$1">
              using NYC fallback
            </Text>
          ) : null}
        </XStack>

        {!online ? (
          <Card padding="$3" bordered>
            <Text color="$color10">
              Offline — showing the last loaded results. Reconnect to refresh.
            </Text>
          </Card>
        ) : null}

        {errorMsg ? (
          <Card padding="$3" bordered borderColor="$red8">
            <Text color="$red10">{errorMsg}</Text>
          </Card>
        ) : null}

        {body ? <NearMeMeta body={body} /> : null}

        {near.isPending && places.length === 0 ? (
          <YStack alignItems="center" padding="$4">
            <Spinner />
          </YStack>
        ) : places.length === 0 ? (
          <Card padding="$3" bordered>
            <Text color="$color10">
              No places within 3 km. Move the radius (coming in the next slice) or try a different
              location.
            </Text>
          </Card>
        ) : (
          <YStack gap="$2">
            {places.map((p) => (
              <PlaceRow key={p.id} place={p} />
            ))}
          </YStack>
        )}
      </YStack>
    </ScrollView>
  );
}

function NearMeMeta({ body }: { body: NearMeNowResponseDto }) {
  const weather = body.weather as unknown as {
    summary?: string;
    maxTempC?: number;
    minTempC?: number;
  };
  const safety = body.safety as unknown as { tier?: string; summary?: string };
  return (
    <XStack gap="$2" flexWrap="wrap">
      <Card padding="$2" bordered>
        <Text fontSize="$2" color="$color10">
          ☂︎{' '}
          {weather.summary ??
            `${Math.round(weather.maxTempC ?? 0)}° / ${Math.round(weather.minTempC ?? 0)}°`}
        </Text>
      </Card>
      <Card padding="$2" bordered>
        <Text fontSize="$2" color="$color10">
          ⊕ {safety.tier ?? 'unknown'} — {safety.summary ?? 'no safety data'}
        </Text>
      </Card>
    </XStack>
  );
}

function PlaceRow({ place: p }: { place: NearMePlaceDto }) {
  const distanceLabel =
    p.distanceMeters < 1000
      ? `${Math.round(p.distanceMeters)} m`
      : `${(p.distanceMeters / 1000).toFixed(1)} km`;
  const walking = p.routes.find((r) => r.mode === 'walk');
  return (
    <Card padding="$3" bordered>
      <YStack gap="$1">
        <Text fontSize="$5" fontWeight="600">
          {p.name}
        </Text>
        <Text fontSize="$2" color="$color10">
          {p.category} · {distanceLabel} away
          {walking ? ` · 🚶 ${formatDuration(walking.durationSeconds)}` : ''}
        </Text>
      </YStack>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
