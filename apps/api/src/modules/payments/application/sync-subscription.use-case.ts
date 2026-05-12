/**
 * POST.9 — Persist a Stripe subscription state change locally:
 *   - upsert the `Subscription` row keyed by `stripeSubscriptionId`
 *   - flip `User.role` to 'premium' on active states, back to 'user'
 *     on cancel/expired
 *
 * Idempotent on `stripeSubscriptionId` so duplicate webhooks (which
 * Stripe will retry on any 5xx) don't create dupes. Both writes
 * happen in a single transaction so a partial failure can't leave
 * the user in a "subscription row exists but role unflipped" limbo.
 *
 * Caveat: per `feedback_role_jwt_relogin.md`, flipping `role` in
 * the DB does NOT update the user's existing JWT — they have to
 * re-login (or refresh) for the new role to land in their token.
 * The /account/billing page exposes the new state immediately
 * because it queries Prisma each request.
 *
 * Installed by prompt [POST.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { PrismaService } from '../../../common/db/prisma.service';

export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface SyncSubscriptionCommand {
  readonly internalUserId: string;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly status: StripeSubscriptionStatus;
  readonly priceCents: number;
  readonly currency: string;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
}

/** Stripe statuses that grant Premium. Anything else (canceled,
 *  unpaid, expired, paused) drops the user back to 'user'. */
const PREMIUM_STATUSES: ReadonlySet<StripeSubscriptionStatus> = new Set(['trialing', 'active']);

@Injectable()
export class SyncSubscriptionUseCase {
  private readonly logger: AppLogger = createLogger('payments.sync-subscription');

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(cmd: SyncSubscriptionCommand): Promise<void> {
    const grantsPremium = PREMIUM_STATUSES.has(cmd.status);
    await this.prisma.$transaction(async (tx) => {
      // Upsert the Subscription row keyed by stripeSubscriptionId
      // (which has @unique in the schema).
      await tx.subscription.upsert({
        where: { stripeSubscriptionId: cmd.stripeSubscriptionId },
        create: {
          userId: cmd.internalUserId,
          stripeCustomerId: cmd.stripeCustomerId,
          stripeSubscriptionId: cmd.stripeSubscriptionId,
          status: cmd.status,
          priceCents: cmd.priceCents,
          currency: cmd.currency,
          currentPeriodEnd: cmd.currentPeriodEnd,
          cancelAtPeriodEnd: cmd.cancelAtPeriodEnd,
        },
        update: {
          status: cmd.status,
          stripeCustomerId: cmd.stripeCustomerId,
          priceCents: cmd.priceCents,
          currency: cmd.currency,
          currentPeriodEnd: cmd.currentPeriodEnd,
          cancelAtPeriodEnd: cmd.cancelAtPeriodEnd,
        },
      });
      // Flip role. Don't downgrade admins — admin > premium in the
      // privilege hierarchy and a paid sub shouldn't strip admin.
      // Symmetrically, a cancel webhook never demotes admins.
      const current = await tx.user.findUnique({
        where: { id: cmd.internalUserId },
        select: { role: true },
      });
      if (!current) return;
      if (current.role === 'admin' || current.role === 'compliance' || current.role === 'sre') {
        return; // Privileged role; subscription doesn't drive it.
      }
      const targetRole = grantsPremium ? 'premium' : 'user';
      if (current.role !== targetRole) {
        await tx.user.update({
          where: { id: cmd.internalUserId },
          data: { role: targetRole },
        });
      }
    });
    this.logger.info(
      {
        internalUserId: cmd.internalUserId,
        stripeSubscriptionId: cmd.stripeSubscriptionId,
        status: cmd.status,
        grantsPremium,
      },
      'subscription_synced',
    );
  }
}
