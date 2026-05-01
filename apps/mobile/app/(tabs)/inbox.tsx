/**
 * V.UX.27 — Inbox tab. Mirrors the web's V.UX.26 `/inbox` surface
 * with mobile-native gestures: pull-to-refresh + long-press to
 * archive (swipe-to-archive lands when react-native-swipeable-row
 * is added in sub-prompt 2).
 *
 * Installed by prompt [V.UX.27].
 */
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
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

  const onRefresh = useCallback(() => {
    void list.refetch();
  }, [list]);

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
            return (
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
                <Button
                  size="$2"
                  onPress={() => {
                    archive.mutate({ id: item.id }, { onSuccess: () => void list.refetch() });
                  }}
                >
                  📥
                </Button>
              </XStack>
            );
          }}
        />
      )}
    </YStack>
  );
}
