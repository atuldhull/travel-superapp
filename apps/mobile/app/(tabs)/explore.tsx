/**
 * V.UX.27 — Explore tab. v1 stub: links to discover-on-web + the
 * near-me composite (V.UX.7) once we wire geolocation. Intentionally
 * thin in this slice — sub-prompt 2 fills it in with the federated
 * places list + near-me cards.
 *
 * Installed by prompt [V.UX.27].
 */
import { Linking, ScrollView } from 'react-native';
import { Button, Text, YStack } from 'tamagui';

export default function ExploreScreen() {
  const openWeb = (path: string) => {
    void Linking.openURL(`https://travelsuperapp.local${path}`);
  };
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <YStack padding="$4" gap="$3">
        <Text fontSize={18} fontWeight="700">
          Explore
        </Text>
        <Text color="$color10">
          The full near-me + hidden-gem discovery surfaces land in the next mobile sub-prompt. For
          now, jump to the web equivalents:
        </Text>
        <Button onPress={() => openWeb('/discover')}>✨ Hidden gems</Button>
        <Button onPress={() => openWeb('/near-me')}>📍 Near me</Button>
        <Button onPress={() => openWeb('/featured')}>⭐ Featured trips</Button>
      </YStack>
    </ScrollView>
  );
}
