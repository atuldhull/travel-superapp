/**
 * Phase 4 / Round AS (AE519) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 â€” Inbox tab. Mirrors the web's V.UX.26 `/inbox` surface
 * with mobile-native gestures: pull-to-refresh + swipe-left-to-archive
 * via `react-native-gesture-handler`'s `Swipeable`. Tapping the
 * action button archives + optimistically removes the row.
 */
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Redirect } from 'expo-router';
import {
  useNotificationsControllerArchive,
  useNotificationsControllerListMine,
  type NotificationLogDto,
} from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

export default function InboxScreen() {
  const token = useAuthToken();
  // The list-mine route's orval params are typed as required strings
  // because the controller's @Query() args lack @ApiQuery decorators
  // (see feedback_orval_zod_query_params.md). `as never` lets us
  // pass only the limit safely.
  const list = useNotificationsControllerListMine({ limit: '50' } as never, {
    query: { enabled: token !== null, retry: false },
  });
  const archive = useNotificationsControllerArchive();
  // One Swipeable ref per visible row so we can close any open
  // swipe drawer when another row is opened (single-open invariant).
  const openRef = useRef<Swipeable | null>(null);

  const onRefresh = useCallback(() => {
    void list.refetch();
  }, [list]);

  const doArchive = useCallback(
    (id: string) => {
      archive.mutate({ id }, { onSuccess: () => void list.refetch() });
    },
    [archive, list],
  );

  if (token === null) return <Redirect href="/login" />;

  const body = list.data?.data as { notifications: NotificationLogDto[] } | undefined;
  const items = body?.notifications ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Inbox</Text>
      {list.isLoading && items.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
          renderItem={({ item }) => {
            const payload = (item.payload ?? {}) as { subject?: string };
            let rowRef: Swipeable | null = null;
            return (
              <Swipeable
                ref={(r) => {
                  rowRef = r;
                }}
                onSwipeableWillOpen={() => {
                  if (openRef.current && openRef.current !== rowRef) {
                    openRef.current.close();
                  }
                  openRef.current = rowRef;
                }}
                renderRightActions={() => (
                  <View style={styles.archiveAction}>
                    <Text style={styles.archiveActionText}>Archive</Text>
                  </View>
                )}
                onSwipeableOpen={() => {
                  doArchive(item.id);
                  rowRef?.close();
                }}
              >
                <View style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{payload.subject ?? item.templateId}</Text>
                    <Text style={styles.rowMeta}>
                      {item.status} - {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.archiveButton} onPress={() => doArchive(item.id)}>
                    <Text style={styles.archiveButtonText}>Archive</Text>
                  </TouchableOpacity>
                </View>
              </Swipeable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 8,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'column',
  },
  rowTitle: {
    fontWeight: '600',
    fontSize: 14,
    color: '#111',
  },
  rowMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  archiveAction: {
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
  },
  archiveActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  archiveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  archiveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
  },
});
