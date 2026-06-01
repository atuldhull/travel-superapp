/**
 * Phase 4 / Round AS (AE521) -- Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 -- trip detail. Mirrors the web's `/trips/[id]` core
 * content: title, dates, status, and the day-by-day itinerary.
 *
 * Offline behaviour: the persisted query cache renders the
 * last-fetched trip + itinerary even when the device is offline,
 * with a banner that flips on the failed refetch. This satisfies
 * the persona's "Airplane mode shows last cached trips" criterion.
 *
 * Installed by prompt [V.UX.27].
 */
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  useTripControllerGetItinerary,
  useTripControllerGetOne,
  type ItineraryListResponseDto,
  type TripWithRoleResponseDto,
} from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { useOnlineStatus } from '../../lib/use-online-status';
import { tripDeepLink } from '../../lib/deep-links';

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
        <View style={styles.container}>
          {!online ? (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>Offline -- showing the last cached itinerary.</Text>
            </View>
          ) : null}
          {trip.isLoading && !tripBody ? (
            <ActivityIndicator />
          ) : tripBody ? (
            <View style={styles.tripHeader}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{tripBody.trip.title}</Text>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => {
                    void Share.share({
                      message: tripDeepLink(tripBody.trip.id),
                      title: tripBody.trip.title,
                    });
                  }}
                >
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.meta}>
                {tripBody.role} - {tripBody.trip.status} - radius {tripBody.trip.radiusKm} km
              </Text>
              <Text style={styles.meta}>
                {(tripBody.trip.startsOn as unknown as string | null) ?? '-'} -&gt;{' '}
                {(tripBody.trip.endsOn as unknown as string | null) ?? '-'}
              </Text>
            </View>
          ) : trip.isError ? (
            <Text style={styles.errorText}>Couldn&apos;t load this trip.</Text>
          ) : null}
          <Text style={styles.sectionHeading}>Itinerary</Text>
          {itinerary.isLoading && days.length === 0 ? (
            <ActivityIndicator />
          ) : days.length === 0 ? (
            <Text style={styles.muted}>No days yet.</Text>
          ) : (
            days.map((day, di) => (
              <View key={day.id} style={styles.dayBlock}>
                <Text style={styles.dayHeading}>
                  Day {di + 1} - {day.date}
                </Text>
                {day.items.length === 0 ? (
                  <Text style={styles.mutedSmall}>Empty</Text>
                ) : (
                  day.items.map((it) => {
                    const start = it.startTime as unknown as string | null;
                    const notes = it.notes as unknown as string | null;
                    const placeId = it.placeId as unknown as string | null;
                    return (
                      <Text key={it.id} style={styles.itemText}>
                        - {placeId ?? notes ?? `Item ${it.position + 1}`}
                        {start ? ` - ${start}` : ''}
                      </Text>
                    );
                  })
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    padding: 16,
    gap: 12,
  },
  offlineBanner: {
    padding: 8,
    backgroundColor: '#b45309',
    borderRadius: 6,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
  },
  tripHeader: {
    flexDirection: 'column',
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  shareButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  muted: {
    color: '#6b7280',
    fontSize: 14,
  },
  mutedSmall: {
    color: '#6b7280',
    fontSize: 12,
  },
  dayBlock: {
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  },
  dayHeading: {
    fontWeight: '600',
    fontSize: 14,
  },
  itemText: {
    fontSize: 13,
    color: '#111827',
  },
});
