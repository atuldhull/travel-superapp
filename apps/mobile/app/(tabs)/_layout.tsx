/**
 * V.UX.27 — bottom-tab layout. Four tabs mirror the web's primary
 * surfaces: Trips, Explore (near-me + discover), Inbox (notifications),
 * Profile (whoami + sign-out).
 *
 * Icon strings are emoji for now — swap to lucide-react-native once
 * Tamagui's icon set is wired up (deferred to V.UX.27 sub-prompt 2).
 *
 * Installed by prompt [V.UX.27].
 */
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#525252',
        headerStyle: { backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarLabel: 'Trips',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarLabel: 'Inbox',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
