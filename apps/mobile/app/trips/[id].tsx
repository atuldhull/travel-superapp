/**
 * V.UX.27 — trip detail. Mirrors the web's `/trips/[id]` core
 * content: title, dates, status, and the day-by-day itinerary.
 *
 * Offline behaviour: the persisted query cache renders the
 * last-fetched trip + itinerary even when the device is offline,
 * with a banner that flips on the failed refetch. This satisfies
 * the persona's "Airplane mode shows last cached trips" criterion.
 *
 * Installed by prompt [V.UX.27].
 */
import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryListResponseDto,
  type TripWithRoleResponseDto,
} from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { useOnlineStatus } from '../../lib/use-online-status';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthToken();
  const online = useOnlineStatus();

  const trip = useTripControllerGetOne(id ?? '', {
    query: { enabled: token !== null && !!id, retry: false },
  });
  const itinerary = useTripControllerGetItinerary(id ?? '', {
    query: { enabled: token !== null && !!id, retry: false },
  });

  const tripBody = trip.data?.data as TripWithRoleResponseDto | undefined;
  const itineraryBody = itinerary.data?.data as ItineraryListResponseDto | undefined;
  const days = itineraryBody?.days ?? [];

  return (
    <>
      <Stack.Screen options={{ title: tripBody?.trip.title ?? 'Trip' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <YStack padding="$4" gap="$3">
          {!online ? (
            <YStack padding="$2" backgroundColor="#b45309" borderRadius="$2">
              <Text color="white" fontSize={12}>
                ✈️ Offline — showing the last cached itinerary.
              </Text>
            </YStack>
          ) : null}
          {trip.isLoading && !tripBody ? (
            <Spinner />
          ) : tripBody ? (
            <YStack gap="$2">
              <Text fontSize={20} fontWeight="700">
                {tripBody.trip.title}
              </Text>
              <Text fontSize={12} color="$color10">
                {tripBody.role} · {tripBody.trip.status} · radius {tripBody.trip.radiusKm} km
              </Text>
              <Text fontSize={12} color="$color10">
                {(tripBody.trip.startsOn as unknown as string | null) ?? '—'} →{' '}
                {(tripBody.trip.endsOn as unknown as string | null) ?? '—'}
              </Text>
            </YStack>
          ) : trip.isError ? (
            <Text color="$red10">Couldn&apos;t load this trip.</Text>
          ) : null}
          <Text fontSize={16} fontWeight="600" marginTop="$3">
            Itinerary
          </Text>
          {itinerary.isLoading && days.length === 0 ? (
            <Spinner />
          ) : days.length === 0 ? (
            <Text color="$color10">No days yet.</Text>
          ) : (
            days.map((day, di) => (
              <YStack key={day.id} gap="$1" marginBottom="$3">
                <Text fontWeight="600">
                  Day {di + 1} · {day.date}
                </Text>
                {day.items.length === 0 ? (
                  <Text fontSize={12} color="$color10">
                    Empty
                  </Text>
                ) : (
                  day.items.map((it) => {
                    const start = it.startTime as unknown as string | null;
                    const notes = it.notes as unknown as string | null;
                    const placeId = it.placeId as unknown as string | null;
                    return (
                      <Text key={it.id} fontSize={13}>
                        • {placeId ?? notes ?? `Item ${it.position + 1}`}
                        {start ? ` · ${start}` : ''}
                      </Text>
                    );
                  })
                )}
              </YStack>
            ))
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
