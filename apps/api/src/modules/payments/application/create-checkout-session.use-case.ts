/**
 * POST.9 — Create a Stripe Checkout session for the Premium tier.
 *
 * Flow:
 *   1. Look up the caller's email + any existing Subscription row
 *      so we can re-use the Stripe Customer id (avoids duplicate
 *      Customer rows in Stripe when the user returns).
 *   2. Delegate to `PaymentProviderPort.createCheckoutSession`
 *      (Stripe adapter) and return the redirect URL to the
 *      controller.
 *
 * The use-case is auth-only — the controller layer enforces that.
 *
 * Installed by prompt [POST.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import {
  PAYMENT_PROVIDER,
  type CheckoutSessionResult,
  type PaymentProviderPort,
} from './ports/payment-provider.port';

export interface CreateCheckoutSessionCommand {
  readonly userId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

@Injectable()
export class CreateCheckoutSessionUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProviderPort,
  ) {}

  async execute(cmd: CreateCheckoutSessionCommand): Promise<CheckoutSessionResult> {
    // Pull email + the most-recent Subscription (if any) in one round-trip.
    // `emailEncrypted` is utf-8 bytes (Playbook §13.11) — decode for the
    // Stripe Customer's `email` field (where it lives in the clear by
    // necessity — Stripe needs it for receipts).
    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      select: {
        emailEncrypted: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { stripeCustomerId: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundError('User not found', { userId: cmd.userId }, 'USER_NOT_FOUND');
    }
    const existingCustomerId = user.subscriptions[0]?.stripeCustomerId;
    return this.payments.createCheckoutSession({
      userId: cmd.userId,
      userEmail: Buffer.from(user.emailEncrypted).toString('utf8'),
      ...(existingCustomerId ? { stripeCustomerId: existingCustomerId } : {}),
      successUrl: cmd.successUrl,
      cancelUrl: cmd.cancelUrl,
    });
  }
}
