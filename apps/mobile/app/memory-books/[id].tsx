/**
 * V.UX.27 — memory-book detail. Read-only render of the book + its
 * captioned assets. The web's edit + reorder + theme picker
 * (V.UX.11/12) lands in a follow-up sub-prompt; native gestures
 * (long-press to reorder) need react-native-draggable-flatlist.
 *
 * Installed by prompt [V.UX.27].
 */
import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { useMemoryBookControllerGetOne, type MemoryBookWithAssetsResponseDto } from '@app/sdk';
import { useAuthToken } from '../../lib/use-auth-token';

export default function MemoryBookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthToken();
  const book = useMemoryBookControllerGetOne(id ?? '', {
    query: { enabled: token !== null && !!id, retry: false },
  });

  const body = book.data?.data as MemoryBookWithAssetsResponseDto | undefined;

  return (
    <>
      <Stack.Screen options={{ title: body?.book.title ?? 'Memory book' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <YStack padding="$4" gap="$3">
          {book.isLoading && !body ? (
            <Spinner />
          ) : body ? (
            <YStack gap="$2">
              <Text fontSize={20} fontWeight="700">
                {body.book.title}
              </Text>
              <Text fontSize={12} color="$color10">
                {(body.book.publishedAt as unknown as string | null) !== null ? 'Public' : 'Draft'}{' '}
                · {body.assets.length} asset{body.assets.length === 1 ? '' : 's'}
              </Text>
              <Text fontSize={12} color="$color10">
                Theme: {body.book.theme}
              </Text>
              <Text fontSize={16} fontWeight="600" marginTop="$3">
                Assets
              </Text>
              {body.assets.length === 0 ? (
                <Text color="$color10">No assets attached yet.</Text>
              ) : (
                body.assets.map((a) => (
                  <YStack key={a.id} padding="$2" backgroundColor="$color3" borderRadius="$2">
                    <Text fontSize={12} color="$color10">
                      Position {a.position} · {a.id}
                    </Text>
                    {a.caption ? <Text marginTop="$1">{a.caption}</Text> : null}
                  </YStack>
                ))
              )}
            </YStack>
          ) : (
            <Text color="$red10">Couldn&apos;t load this book.</Text>
          )}
        </YStack>
      </ScrollView>
    </>
  );
}
