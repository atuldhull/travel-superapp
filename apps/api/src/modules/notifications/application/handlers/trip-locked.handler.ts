/**
 * V.UX.9 handler for `Trip.TripLocked`. When the owner freezes the
 * plan, every active collaborator (anyone who has voted or recorded
 * an expense on the trip) gets a notification.
 *
 * "Active collaborator" intentionally excludes the owner — the
 * lock action originated from them; we don't echo back.
 *
 * Same lifecycle + isolation pattern as ItineraryReadyHandler.
 *
 * Installed by prompt [V.UX.9].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { PrismaService } from '../../../../common/db/prisma.service';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { TripLockedPayload } from '../../../trip';

const log = createLogger('notifications.trip-locked');

const CONSUMER_GROUP = 'notifications.trip-locked';
const EVENT_NAME = 'Trip.TripLocked';

@Injectable()
export class TripLockedHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<TripLockedPayload>(
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
    payload: TripLockedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    const collaborators = await this.findActiveCollaborators(payload.tripId, payload.ownerId);
    log.info(
      {
        eventId,
        traceId,
        tripId: payload.tripId,
        ownerId: payload.ownerId,
        recipientCount: collaborators.length,
      },
      'trip_locked_recipients_resolved',
    );
    for (const userId of collaborators) {
      await this.sender.send({
        userId,
        channel: 'push',
        templateKey: 'trip_locked',
        subject: 'Trip plan locked',
        body: `"${payload.title}" is now locked. You can still vote and log expenses, but only the owner can edit the itinerary.`,
        context: {
          eventId,
          traceId: traceId ?? null,
          tripId: payload.tripId,
        },
      });
    }
  }

  /**
   * Distinct user-ids that have voted or paid an expense on this
   * trip — the owner's own id is filtered out so they don't get
   * notified about their own lock.
   */
  private async findActiveCollaborators(
    tripId: string,
    ownerId: string,
  ): Promise<readonly string[]> {
    const [voters, payers] = await Promise.all([
      this.prisma.vote.findMany({
        where: { tripId, userId: { not: ownerId } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.expense.findMany({
        where: { tripId, paidById: { not: ownerId } },
        select: { paidById: true },
        distinct: ['paidById'],
      }),
    ]);
    const ids = new Set<string>();
    for (const v of voters) ids.add(v.userId);
    for (const p of payers) ids.add(p.paidById);
    return [...ids];
  }
}
