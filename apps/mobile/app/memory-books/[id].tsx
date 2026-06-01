/**
 * Phase 4 / Round AS (AE521) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * Memory-book detail + editing â€” `/memory-books/[id]`.
 *
 * [S-D3] replaces the V.UX.27 read-only stub with owner editing:
 *   - Title (inline edit)
 *   - Theme (segmented picker)
 *   - Per-asset caption (Alert.prompt inline edit)
 *   - Per-asset reorder (up / down arrows; uses
 *     `useMemoryBookControllerReorderAssets`)
 *
 * Thumbnail rendering is intentionally NOT in this slice â€” the owner-
 * facing `GET .../assets/:id/download-url` endpoint doesn't exist yet
 * (only the public one). Adding it is a backend slice; mobile + web
 * memory-book detail both wait on it.
 */
import {
  Alert,
  RefreshControl,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useMemo, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
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
        <View style={styles.container}>
          {book.isLoading && !body ? (
            <ActivityIndicator />
          ) : !body ? (
            <Text style={styles.errorText}>Couldn't load this book.</Text>
          ) : (
            <View style={styles.stackGap12}>
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

              <Text style={styles.metaText}>
                {(body.book.publishedAt as unknown as string | null) !== null ? 'Public' : 'Draft'}{' '}
                {String.fromCharCode(183)} {sortedAssets.length} asset
                {sortedAssets.length === 1 ? '' : 's'}
              </Text>

              <Text style={[styles.h4, styles.h4Spacing]}>Assets</Text>
              {sortedAssets.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.metaText}>
                    No assets yet. Upload from the web for now - mobile upload lands in a follow-up.
                  </Text>
                </View>
              ) : (
                <View style={styles.stackGap8}>
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
                </View>
              )}

              <Text style={[styles.footnote, styles.footnoteSpacing]}>
                Thumbnails coming once the owner-facing asset-download-URL endpoint ships (backend
                slice tracked in PROGRESS).
              </Text>
            </View>
          )}
        </View>
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
    <View style={styles.stackGap4}>
      <Text style={styles.metaText}>Title</Text>
      <View style={styles.rowGap8}>
        <TextInput style={styles.input} value={value} onChangeText={setValue} maxLength={120} />
        {dirty ? (
          <TouchableOpacity
            style={[styles.button, isPending ? styles.buttonDisabled : null]}
            disabled={isPending}
            onPress={() => onSave(value.trim())}
          >
            <Text style={styles.buttonText}>{isPending ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
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
    <View style={styles.stackGap4}>
      <Text style={styles.metaText}>Theme</Text>
      <View style={styles.rowWrap}>
        {THEME_OPTIONS.map((t) => {
          const active = t === current;
          const isDisabled = isPending || active;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.buttonSmall,
                active ? styles.buttonActive : null,
                isDisabled && !active ? styles.buttonDisabled : null,
              ]}
              disabled={isDisabled}
              onPress={() => onPick(t)}
            >
              <Text style={[styles.buttonText, active ? styles.buttonTextActive : null]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
  const upDisabled = !canMoveUp || isPendingReorder;
  const downDisabled = !canMoveDown || isPendingReorder;
  return (
    <View style={styles.card}>
      <View style={styles.rowGap8}>
        <View style={[styles.stackGap4, styles.flex1]}>
          <Text style={styles.metaText}>
            Position {asset.position + 1} {String.fromCharCode(183)} {asset.kind}
          </Text>
          {caption ? (
            <Text style={styles.bodyText}>{caption}</Text>
          ) : (
            <Text style={styles.metaText}>No caption</Text>
          )}
          <TouchableOpacity style={[styles.buttonTiny, styles.alignStart]} onPress={onEditCaption}>
            <Text style={styles.buttonText}>Edit caption</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stackGap4}>
          <TouchableOpacity
            style={[styles.buttonTiny, upDisabled ? styles.buttonDisabled : null]}
            disabled={upDisabled}
            onPress={() => onMove(-1)}
          >
            <Text style={styles.buttonText}>up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.buttonTiny, downDisabled ? styles.buttonDisabled : null]}
            disabled={downDisabled}
            onPress={() => onMove(1)}
          >
            <Text style={styles.buttonText}>down</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'column',
    gap: 12,
  },
  stackGap4: {
    flexDirection: 'column',
    gap: 4,
  },
  stackGap8: {
    flexDirection: 'column',
    gap: 8,
  },
  stackGap12: {
    flexDirection: 'column',
    gap: 12,
  },
  rowGap8: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  flex1: {
    flex: 1,
  },
  alignStart: {
    alignSelf: 'flex-start',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  bodyText: {
    fontSize: 14,
    color: '#111',
  },
  footnote: {
    fontSize: 11,
    color: '#666',
  },
  footnoteSpacing: {
    marginTop: 8,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  h4Spacing: {
    marginTop: 8,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonTiny: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eee',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 12,
    color: '#111',
  },
  buttonTextActive: {
    color: '#fff',
  },
});
