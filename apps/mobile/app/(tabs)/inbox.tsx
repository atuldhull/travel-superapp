/**
 * V.UX.27 — Inbox tab. Mirrors the web's V.UX.26 `/inbox` surface
 * with mobile-native gestures: pull-to-refresh + swipe-left-to-archive
 * via `react-native-gesture-handler`'s `Swipeable`. Tapping the
 * red action behind the row archives + optimistically removes it.
 *
 * The `📥` tap-button is preserved as a fallback — accessible to
 * users who can't perform the swipe gesture (motor-impairment) and
 * the Expo `--web` target where Swipeable's hit area is finicky.
 *
 * Sub-prompt 2 added the swipe gesture; sub-prompt 1 shipped only
 * the tap-button.
 *
 * Installed by prompt [V.UX.27].
 */
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Redirect } from 'expo-router';
import { Button, Text, XStack, YStack } from 'tamagui';
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
    <YStack flex={1} backgroundColor="$background" padding="$4" gap="$3">
      <Text fontSize={18} fontWeight="700">
        Inbox
      </Text>
      {list.isLoading && items.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text color="$color10">No notifications yet.</Text>}
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
                  <View
                    style={{
                      backgroundColor: '#b91c1c',
                      justifyContent: 'center',
                      paddingHorizontal: 20,
                      marginBottom: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text color="white" fontWeight="700">
                      Archive
                    </Text>
                  </View>
                )}
                onSwipeableOpen={() => {
                  doArchive(item.id);
                  rowRef?.close();
                }}
              >
                <XStack
                  paddingVertical="$2"
                  paddingHorizontal="$3"
                  marginBottom="$2"
                  borderRadius="$3"
                  backgroundColor="$color3"
                  gap="$2"
                  alignItems="center"
                >
                  <YStack flex={1}>
                    <Text fontWeight="600" fontSize={14}>
                      {payload.subject ?? item.templateId}
                    </Text>
                    <Text fontSize={12} color="$color10">
                      {item.status} · {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </YStack>
                  <Button size="$2" onPress={() => doArchive(item.id)}>
                    📥
                  </Button>
                </XStack>
              </Swipeable>
            );
          }}
        />
      )}
    </YStack>
  );
}
