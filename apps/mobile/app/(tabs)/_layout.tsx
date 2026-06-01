/**
 * Phase 4 / Round AS (AE519) â€” Tamagui stripped; uses plain RN primitives.
 * Will be retired entirely when the Aether mobile surface ships.
 *
 * V.UX.27 â€” bottom-tab layout. Four tabs mirror the web's primary
 * surfaces: Trips, Explore (near-me + discover), Inbox (notifications),
 * Profile (whoami + sign-out).
 *
 * Tab icons were previously lucide-react-native via @tamagui/lucide-icons.
 * To keep the patch surface small and avoid pulling in a new icon library,
 * they are rendered as short text glyphs. TODO: replace with proper icons
 * once the Phase 4 Aether mobile surface lands.
 */
import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';

const ACTIVE = '#1d4ed8';
const INACTIVE = '#525252';

type TabIconProps = {
  color: string;
  size: number;
  label: string;
};

function TabIcon({ color, size, label }: TabIconProps) {
  return <Text style={[styles.tabIcon, { color, fontSize: size }]}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        headerStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} size={size} label="T" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} size={size} label="E" />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} size={size} label="I" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} size={size} label="P" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
