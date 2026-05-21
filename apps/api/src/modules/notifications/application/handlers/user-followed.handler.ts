/**
 * Phase 5 (J6) handler for `Social.UserFollowed`. When someone
 * follows a user, the followee gets a notification.
 *
 * Same lifecycle + isolation pattern as TripLockedHandler. The
 * event payload is anemic (ids only) — the follower's display name
 * is resolved here.
 *
 * Installed by prompt [J6].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { PrismaService } from '../../../../common/db/prisma.service';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { UserFollowedPayload } from '../../../social/domain/social.events';

const log = createLogger('notifications.user-followed');

const CONSUMER_GROUP = 'notifications.user-followed';
const EVENT_NAME = 'Social.UserFollowed';

@Injectable()
export class UserFollowedHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<UserFollowedPayload>(
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
    payload: UserFollowedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    const follower = await this.prisma.user.findUnique({
      where: { id: payload.followerId },
      select: { displayName: true },
    });
    const name = follower?.displayName ?? 'Someone';
    log.info(
      { eventId, traceId, followeeId: payload.followeeId },
      'user_followed_notification_dispatch',
    );
    await this.sender.send({
      userId: payload.followeeId,
      channel: 'push',
      templateKey: 'user_followed',
      subject: 'New follower',
      body: `${name} started following you.`,
      context: {
        eventId,
        traceId: traceId ?? null,
        followerId: payload.followerId,
      },
    });
  }
}
