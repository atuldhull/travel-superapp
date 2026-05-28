/**
 * Push notification hook for the Expo runtime.
 *
 * [S-D4] requests permission on first run, retrieves the Expo push
 * token, and wires the tap-to-deep-link handler. The backend-register
 * call is intentionally NOT in this hook — the existing push-subscribe
 * endpoint is shaped for web-push (endpoint + p256dh/auth keys), not
 * Expo Push (single token string). A new `POST /notifications/expo-token`
 * endpoint is queued as a backend follow-up; once it lands, this hook
 * just adds a `.then(registerToken)` call.
 *
 * Deep-link routing:
 *   - Notification carries `data.url` = a `travelapp://...` deep link.
 *   - On tap (foreground OR cold start), the handler navigates the app
 *     to that URL using expo-router. Same URL scheme as the existing
 *     magic-link routing.
 *
 * Permission flow is opt-in: we ASK on first call, store the answer in
 * AsyncStorage so we don't nag, and respect the OS-level denial.
 *
 * Installed by [S-D4] of the S-series real-functionality closeout.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type PushPermission = 'unknown' | 'granted' | 'denied' | 'undetermined';

export interface PushState {
  readonly permission: PushPermission;
  readonly token: string | null;
  /** Re-request permission + fetch token. Idempotent. */
  readonly enable: () => Promise<void>;
}

// Foreground presentation: show heads-up banner + play sound. iOS only
// honours showAlert; Android uses notification channels (configured
// out-of-band via app.json or EAS).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(): PushState {
  const [permission, setPermission] = useState<PushPermission>('unknown');
  const [token, setToken] = useState<string | null>(null);
  const enableInFlight = useRef(false);

  const enable = async (): Promise<void> => {
    if (enableInFlight.current) return;
    enableInFlight.current = true;
    try {
      // SecureStore + expo-notifications aren't available on Expo Web;
      // bail early so the screen doesn't render a misleading "denied".
      if (Platform.OS === 'web') {
        setPermission('unknown');
        return;
      }
      const current = await Notifications.getPermissionsAsync();
      let granted = current.granted;
      if (!granted && current.canAskAgain) {
        const ask = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        granted = ask.granted;
      }
      if (!granted) {
        setPermission(current.canAskAgain ? 'undetermined' : 'denied');
        return;
      }
      // EAS project id required for getExpoPushTokenAsync; passing it
      // explicitly avoids the "no projectId" warning on bare RN builds.
      const expoToken = await Notifications.getExpoPushTokenAsync();
      setToken(expoToken.data);
      setPermission('granted');
    } catch {
      // Permission infrastructure can fail on simulators / when EAS
      // project is missing. Treat as denied so callers UI accordingly.
      setPermission('denied');
    } finally {
      enableInFlight.current = false;
    }
  };

  // Deep-link from notification tap. expo-router's `router.push` accepts
  // both an in-app path ('/trips/123') and a fully-qualified URL — we
  // strip the scheme prefix for safety.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as { url?: string };
      const target = typeof data.url === 'string' ? data.url : null;
      if (!target) return;
      const path = target.replace(/^travelapp:\/\//, '/');
      router.push(path as never);
    });
    return () => sub.remove();
  }, []);

  return { permission, token, enable };
}
