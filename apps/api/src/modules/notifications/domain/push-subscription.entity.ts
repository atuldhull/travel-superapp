/**
 * V.UX.26 — Web Push API subscription. One row per browser install;
 * `endpoint` is globally unique. `p256dh` and `auth` are the
 * encryption keys per Web Push spec §3 — opaque base64 strings; we
 * never inspect them, only forward to `web-push.sendNotification()`.
 *
 * Installed by prompt [V.UX.26].
 */
export interface PushSubscription {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
