/**
 * Phase 4 / Round AS (AE519) -- Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 -- Trips tab. Mirrors the web's `/trips` route: lists the
 * caller's owned trips + the trips they're a collaborator on.
 *
 * Pull-to-refresh hooks the React-Query refetch. Offline behaviour
 * is automatic via the persisted query cache (lib/offline-cache.ts).
 */
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useTripControllerList, type ListTripsResponseDto, type TripDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';
import { useOnlineStatus } from '../../lib/use-online-status';

export default function TripsScreen() {
  const token = useAuthToken();
  const online = useOnlineStatus();
  // [S-D1 follow-up] orval regen for S-C1 (archive/unarchive) made
  // `archived` required on the list params; mobile default is the
  // non-archived list (same as the web /trips page).
  const trips = useTripControllerList(
    { limit: '50', archived: 'false' },
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
    <View style={styles.container}>
      {!online ? (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>You are offline -- showing the last cached trips.</Text>
        </View>
      ) : null}
      <Text style={styles.heading}>Your trips</Text>
      {trips.isLoading && all.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={all}
          keyExtractor={(t: TripDto) => t.id}
          refreshControl={<RefreshControl refreshing={trips.isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No trips yet. Create one on the web app.</Text>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/trips/[id]', params: { id: item.id } }} asChild>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {item.status} - radius {item.radiusKm} km
                </Text>
              </View>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  rowTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  rowMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  offline: {
    backgroundColor: '#b45309',
    padding: 8,
    borderRadius: 6,
  },
  offlineText: {
    color: '#ffffff',
    fontSize: 12,
  },
});
