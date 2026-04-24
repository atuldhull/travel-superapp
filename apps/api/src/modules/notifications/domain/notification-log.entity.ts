/**
 * Plain-data `NotificationLog` domain entity. Mirrors the Prisma
 * row that backs the queryable notification history. Subscribers
 * write here so users can `GET /notifications/me` and ops can
 * audit fan-out.
 *
 * Installed by prompt [IV.18.15.1].
 */
export type NotificationChannel = 'push' | 'email' | 'sms';
export type NotificationDeliveryStatus = 'queued' | 'delivered' | 'suppressed' | 'failed';

export interface NotificationLog {
  readonly id: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly templateId: string;
  readonly status: NotificationDeliveryStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly read: boolean;
  readonly createdAt: Date;
  readonly deliveredAt: Date | null;
}
