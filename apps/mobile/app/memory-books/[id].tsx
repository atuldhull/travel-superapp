/**
 * Memory-book detail + editing — `/memory-books/[id]`.
 *
 * [S-D3] replaces the V.UX.27 read-only stub with owner editing:
 *   - Title (inline edit)
 *   - Theme (segmented picker)
 *   - Per-asset caption (Alert.prompt inline edit)
 *   - Per-asset reorder (up / down arrows; uses
 *     `useMemoryBookControllerReorderAssets`)
 *
 * Thumbnail rendering is intentionally NOT in this slice — the owner-
 * facing `GET .../assets/:id/download-url` endpoint doesn't exist yet
 * (only the public one). Adding it is a backend slice; mobile + web
 * memory-book detail both wait on it. Z1 audit's "renders position+id
 * not image" gap is acknowledged + deferred to a follow-up.
 *
 * Asset upload via camera / library is also deferred — the existing
 * web flow is upload-confirmation-driven and needs a mobile-port that
 * exceeds this slice's scope.
 *
 * Installed by [S-D3] of the S-series real-functionality closeout.
 */
import { Alert, RefreshControl, ScrollView } from 'react-native';
import { useMemo, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, H4, Input, Spinner, Text, XStack, YStack } from 'tamagui';
import {
  getMemoryBookControllerGetOneQueryKey,
  useMemoryBookControllerGetOne,
  useMemoryBookControllerReorderAssets,
  useMemoryBookControllerUpdate,
  useMemoryBookControllerUpdateAssetCaption,
  type MemoryBookAssetSummaryDto,
  type MemoryBookWithAssetsResponseDto,
} from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

const THEME_OPTIONS = ['default', 'minimal', 'editorial', 'travelogue', 'kids'] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

export default function MemoryBookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthToken();
  const bookId = id ?? '';
  const queryClient = useQueryClient();

  const book = useMemoryBookControllerGetOne(bookId, {
    query: { enabled: token !== null && bookId !== '', retry: false },
  });

  const body = book.data?.data as MemoryBookWithAssetsResponseDto | undefined;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getMemoryBookControllerGetOneQueryKey(bookId) });

  const update = useMemoryBookControllerUpdate({
    mutation: { onSuccess: () => void invalidate() },
  });
  const reorder = useMemoryBookControllerReorderAssets({
    mutation: { onSuccess: () => void invalidate() },
  });
  const updateCaption = useMemoryBookControllerUpdateAssetCaption({
    mutation: { onSuccess: () => void invalidate() },
  });

  const sortedAssets = useMemo(
    () => (body ? [...body.assets].sort((a, b) => a.position - b.position) : []),
    [body],
  );

  const moveAsset = (assetId: string, direction: -1 | 1) => {
    const idx = sortedAssets.findIndex((a) => a.id === assetId);
    if (idx < 0) return;
    const swap = idx + direction;
    if (swap < 0 || swap >= sortedAssets.length) return;
    const reordered = [...sortedAssets];
    [reordered[idx], reordered[swap]] = [reordered[swap]!, reordered[idx]!];
    reorder.mutate({
      id: bookId,
      data: { assetIds: reordered.map((a) => a.id) as unknown as never },
    });
  };

  const editCaption = (asset: MemoryBookAssetSummaryDto) => {
    // Alert.prompt is iOS-only. On Android we no-op for now; replace
    // with a proper modal in a follow-up.
    if (typeof Alert.prompt !== 'function') return;
    const current = (asset.caption as unknown as string | null) ?? '';
    Alert.prompt(
      'Edit caption',
      'Max 280 characters; leave empty to clear.',
      (input) => {
        const next = (input ?? '').trim();
        const cleared = next.length === 0;
        updateCaption.mutate({
          id: bookId,
          assetId: asset.id,
          data: {
            caption: (cleared ? null : next.slice(0, 280)) as unknown as never,
          },
        });
      },
      'plain-text',
      current,
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: body?.book.title ?? 'Memory book' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={book.isFetching} onRefresh={invalidate} />}
      >
        <YStack padding="$4" gap="$3">
          {book.isLoading && !body ? (
            <Spinner />
          ) : !body ? (
            <Text color="$red10">Couldn&apos;t load this book.</Text>
          ) : (
            <YStack gap="$3">
              <TitleEditor
                initial={body.book.title}
                isPending={update.isPending}
                onSave={(title) =>
                  update.mutate({ id: bookId, data: { title } as unknown as never })
                }
              />

              <ThemePicker
                current={body.book.theme as ThemeOption}
                isPending={update.isPending}
                onPick={(theme) =>
                  update.mutate({ id: bookId, data: { theme } as unknown as never })
                }
              />

              <Text fontSize="$2" color="$color10">
                {(body.book.publishedAt as unknown as string | null) !== null ? 'Public' : 'Draft'}{' '}
                · {sortedAssets.length} asset{sortedAssets.length === 1 ? '' : 's'}
              </Text>

              <H4 marginTop="$2">Assets</H4>
              {sortedAssets.length === 0 ? (
                <Card padding="$3" bordered>
                  <Text color="$color10">
                    No assets yet. Upload from the web for now — mobile upload lands in a follow-up.
                  </Text>
                </Card>
              ) : (
                <YStack gap="$2">
                  {sortedAssets.map((asset, idx) => (
                    <AssetRow
                      key={asset.id}
                      asset={asset}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < sortedAssets.length - 1}
                      isPendingReorder={reorder.isPending}
                      onMove={(dir) => moveAsset(asset.id, dir)}
                      onEditCaption={() => editCaption(asset)}
                    />
                  ))}
                </YStack>
              )}

              <Text fontSize="$1" color="$color10" marginTop="$2">
                Thumbnails coming once the owner-facing asset-download-URL endpoint ships (backend
                slice tracked in PROGRESS).
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}

function TitleEditor({
  initial,
  isPending,
  onSave,
}: {
  readonly initial: string;
  readonly isPending: boolean;
  readonly onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const dirty = value.trim() !== initial.trim() && value.trim().length > 0;
  return (
    <YStack gap="$1">
      <Text fontSize="$2" color="$color10">
        Title
      </Text>
      <XStack gap="$2" alignItems="center">
        <Input flex={1} value={value} onChangeText={setValue} maxLength={120} />
        {dirty ? (
          <Button size="$2" disabled={isPending} onPress={() => onSave(value.trim())}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  );
}

function ThemePicker({
  current,
  isPending,
  onPick,
}: {
  readonly current: ThemeOption;
  readonly isPending: boolean;
  readonly onPick: (theme: ThemeOption) => void;
}) {
  return (
    <YStack gap="$1">
      <Text fontSize="$2" color="$color10">
        Theme
      </Text>
      <XStack gap="$1" flexWrap="wrap">
        {THEME_OPTIONS.map((t) => {
          const active = t === current;
          return (
            <Button
              key={t}
              size="$2"
              disabled={isPending || active}
              onPress={() => onPick(t)}
              theme={active ? 'active' : null}
            >
              {t}
            </Button>
          );
        })}
      </XStack>
    </YStack>
  );
}

function AssetRow({
  asset,
  canMoveUp,
  canMoveDown,
  isPendingReorder,
  onMove,
  onEditCaption,
}: {
  readonly asset: MemoryBookAssetSummaryDto;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly isPendingReorder: boolean;
  readonly onMove: (dir: -1 | 1) => void;
  readonly onEditCaption: () => void;
}) {
  const caption = asset.caption as unknown as string | null;
  return (
    <Card padding="$3" bordered>
      <XStack gap="$2" alignItems="center">
        <YStack flex={1} gap="$1">
          <Text fontSize="$2" color="$color10">
            Position {asset.position + 1} · {asset.kind}
          </Text>
          {caption ? <Text>{caption}</Text> : <Text color="$color10">No caption</Text>}
          <Button size="$1" alignSelf="flex-start" onPress={onEditCaption}>
            Edit caption
          </Button>
        </YStack>
        <YStack gap="$1">
          <Button size="$1" disabled={!canMoveUp || isPendingReorder} onPress={() => onMove(-1)}>
            ▲
          </Button>
          <Button size="$1" disabled={!canMoveDown || isPendingReorder} onPress={() => onMove(1)}>
            ▼
          </Button>
        </YStack>
      </XStack>
    </Card>
  );
}
