/**
 * V.UX.27 — bottom-tab layout. Four tabs mirror the web's primary
 * surfaces: Trips, Explore (near-me + discover), Inbox (notifications),
 * Profile (whoami + sign-out).
 *
 * Sub-prompt 3 swapped the placeholder icons for lucide-react-native
 * via @tamagui/lucide-icons (auto react-native-svg peer). Active tint
 * tracks the brand colour so the tab bar feels on-brand.
 *
 * Installed by prompt [V.UX.27].
 */
import { Tabs } from 'expo-router';
import { Compass, Inbox, MapPin, User } from '@tamagui/lucide-icons';

const ACTIVE = '#1d4ed8';
const INACTIVE = '#525252';

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
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
