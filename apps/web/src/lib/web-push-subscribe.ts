/**
 * V.UX.26 — Web Push subscription orchestration. Three steps:
 *
 *   1. Register the service worker at /sw.js (idempotent).
 *   2. Request the user's permission (browser prompt).
 *   3. Subscribe via PushManager + POST the {endpoint, keys} to
 *      `/api/v1/notifications/push/subscribe`.
 *
 * The VAPID public key is read from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
 * at runtime; absence skips subscription so dev without VAPID keys
 * Just Works for the rest of the inbox UI.
 *
 * Routes through the orval-generated `pushSubscriptionsController*`
 * functions ([E2]); both endpoints have proper `@ApiBody` decorators
 * (V.UX.26 shipped them), so the typing is strong here — no cast at
 * the boundary.
 *
 * Installed by prompt [V.UX.26].
 */
import {
  pushSubscriptionsControllerSubscribe,
  pushSubscriptionsControllerUnsubscribe,
} from '@app/sdk';

export type WebPushSubscribeResult =
  | { kind: 'subscribed'; endpoint: string }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'no-vapid' }
  | { kind: 'error'; message: string };

export async function ensureWebPushSubscription(): Promise<WebPushSubscribeResult> {
  if (typeof window === 'undefined') return { kind: 'unsupported' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { kind: 'unsupported' };
  }
  const vapidKey = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'];
  if (!vapidKey) return { kind: 'no-vapid' };

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { kind: 'denied' };

    let sub = await reg.pushManager.getSubscription();
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { kind: 'error', message: 'Subscription missing endpoint or keys' };
    }
    await pushSubscriptionsControllerSubscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    return { kind: 'subscribed', endpoint: json.endpoint };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await pushSubscriptionsControllerUnsubscribe({ endpoint });
  } catch {
    /* best-effort; the server-side row will be reaped on the next 410 */
  }
}

/** Standard base64url → Uint8Array conversion required by PushManager.
 *  Returns a fresh ArrayBuffer-backed view so the type matches
 *  `BufferSource` exactly (avoids the SharedArrayBuffer-typed
 *  default Uint8Array constructor signature in newer @types/node). */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
