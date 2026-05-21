/**
 * Phase 5 (J6) handler for `Social.TripCommented`. When someone
 * comments on a published trip, the trip's author gets a
 * notification.
 *
 * The emitting use-case already skips self-comments, but we
 * double-guard here so a future emitter can't accidentally ping a
 * user about their own comment.
 *
 * Same lifecycle + isolation pattern as TripLockedHandler.
 *
 * Installed by prompt [J6].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { PrismaService } from '../../../../common/db/prisma.service';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { TripCommentedPayload } from '../../../social/domain/social.events';

const log = createLogger('notifications.trip-commented');

const CONSUMER_GROUP = 'notifications.trip-commented';
const EVENT_NAME = 'Social.TripCommented';

@Injectable()
export class TripCommentedHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<TripCommentedPayload>(
      EVENT_NAME,
      (evt) => this.handle(evt.payload, evt.id, evt.traceId),
      { consumerGroup: CONSUMER_GROUP },
    );
    log.info({ consumerGroup: CONSUMER_GROUP }, 'notifications_handler_subscribed');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(
    payload: TripCommentedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    // Double-guard: never notify a user about their own comment.
    if (payload.commenterId === payload.tripAuthorId) return;

    const [commenter, trip] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.commenterId },
        select: { displayName: true },
      }),
      this.prisma.trip.findUnique({
        where: { id: payload.tripId },
        select: { title: true },
      }),
    ]);
    const name = commenter?.displayName ?? 'Someone';
    const title = trip?.title ?? 'your trip';
    log.info(
      { eventId, traceId, tripId: payload.tripId, tripAuthorId: payload.tripAuthorId },
      'trip_commented_notification_dispatch',
    );
    await this.sender.send({
      userId: payload.tripAuthorId,
      channel: 'push',
      templateKey: 'trip_commented',
      subject: 'New comment on your trip',
      body: `${name} commented on "${title}".`,
      context: {
        eventId,
        traceId: traceId ?? null,
        tripId: payload.tripId,
        commentId: payload.commentId,
      },
    });
  }
}
