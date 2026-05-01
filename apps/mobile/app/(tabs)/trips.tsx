/**
 * V.UX.27 — Trips tab. Mirrors the web's `/trips` route: lists the
 * caller's owned trips + the trips they're a collaborator on.
 *
 * Pull-to-refresh hooks the React-Query refetch. Offline behaviour
 * is automatic via the persisted query cache (lib/offline-cache.ts).
 *
 * Installed by prompt [V.UX.27].
 */
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { Text, YStack } from 'tamagui';
import { useTripControllerList, type ListTripsResponseDto, type TripDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { useOnlineStatus } from '../../lib/use-online-status';

export default function TripsScreen() {
  const token = useAuthToken();
  const online = useOnlineStatus();
  const trips = useTripControllerList(
    { limit: '50' },
    { query: { enabled: token !== null, retry: false } },
  );

  const onRefresh = useCallback(() => {
    void trips.refetch();
  }, [trips]);

  if (token === null) return <Redirect href="/login" />;

  const body = trips.data?.data as ListTripsResponseDto | undefined;
  const owned = body?.trips ?? [];
  const collaborated = body?.collaborated ?? [];
  const all = [...owned, ...collaborated];

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
      {!online ? (
        <View style={styles.offline}>
          <Text color="white" fontSize={12}>
            ✈️ You&apos;re offline — showing the last cached trips.
          </Text>
        </View>
      ) : null}
      <Text fontSize={18} fontWeight="700">
        Your trips
      </Text>
      {trips.isLoading && all.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={all}
          keyExtractor={(t: TripDto) => t.id}
          refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text color="$color10">No trips yet. Create one on the web app.</Text>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/trips/[id]', params: { id: item.id } }} asChild>
              <View style={styles.row}>
                <Text fontWeight="600">{item.title}</Text>
                <Text fontSize={12} color="$color10">
                  {item.status} · radius {item.radiusKm} km
                </Text>
              </View>
            </Link>
          )}
        />
      )}
    </YStack>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  offline: {
    backgroundColor: '#b45309',
    padding: 8,
    borderRadius: 6,
  },
});
