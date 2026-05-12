/**
 * POST.9 — Payments HTTP surface.
 *
 *   POST /payments/checkout            — auth: create Stripe Checkout
 *                                        session for the Premium tier
 *   POST /payments/webhook             — public: Stripe webhook (raw
 *                                        body + signature verify)
 *   GET  /payments/me/subscription     — auth: current plan for
 *                                        /account/billing
 *   POST /payments/me/portal-url       — auth: mint Stripe Customer
 *                                        Portal URL for cancel /
 *                                        update payment method
 *
 * The PaymentsModule factory returns a `Stub` provider when
 * STRIPE_SECRET_KEY is unset — the controller short-circuits to 503
 * SERVICE_UNAVAILABLE so the /pricing CTA falls back gracefully.
 *
 * Installed by prompt [POST.9].
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { Env } from '@app/config';
import { CurrentUser, Public, type AuthenticatedUser } from '../../../common/auth';
import { PrismaService } from '../../../common/db/prisma.service';
import { CreateCheckoutSessionUseCase } from '../application/create-checkout-session.use-case';
import { HandleStripeWebhookUseCase } from '../application/handle-stripe-webhook.use-case';
import {
  PAYMENT_PROVIDER,
  type PaymentProviderPort,
} from '../application/ports/payment-provider.port';
import {
  CheckoutSessionResponseDto,
  CurrentSubscriptionResponseDto,
  PortalUrlResponseDto,
  WebhookAckResponseDto,
} from './dto/payments-response.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly createCheckout: CreateCheckoutSessionUseCase,
    private readonly handleWebhook: HandleStripeWebhookUseCase,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    // Optional so the controller can still load when STRIPE_SECRET_KEY
    // is absent (the module factory provides a stub or undefined).
    @Optional() @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProviderPort | null,
  ) {}

  /** Whether Stripe is actually wired in this environment. Drives the
   *  503 fallback on every non-public route. */
  private requireStripe(): void {
    if (!this.payments) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_DISABLED',
        message: 'Payments are not configured for this environment.',
      });
    }
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Stripe Checkout session for the Premium tier. Auth-only.',
  })
  @ApiResponse({ status: 200, type: CheckoutSessionResponseDto })
  @ApiResponse({ status: 503, description: 'PAYMENTS_DISABLED — no Stripe key in env.' })
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { readonly successUrl?: string; readonly cancelUrl?: string },
  ): Promise<CheckoutSessionResponseDto> {
    this.requireStripe();
    // Sane defaults driven by WEB_BASE_URL so dev/staging/prod all
    // work without the client knowing the public origin.
    const webBase = this.config.get('WEB_BASE_URL', { infer: true });
    const successUrl =
      typeof body.successUrl === 'string' && body.successUrl.startsWith('http')
        ? body.successUrl
        : `${webBase}/account/billing?session={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      typeof body.cancelUrl === 'string' && body.cancelUrl.startsWith('http')
        ? body.cancelUrl
        : `${webBase}/pricing`;
    const result = await this.createCheckout.execute({
      userId: user.sub,
      successUrl,
      cancelUrl,
    });
    return { sessionId: result.sessionId, url: result.url };
  }

  @ApiOperation({
    summary: 'Stripe webhook. Public + raw body (signature-verified).',
  })
  @ApiResponse({ status: 200, type: WebhookAckResponseDto })
  @ApiResponse({ status: 400, description: 'WEBHOOK_SIGNATURE_INVALID.' })
  @ApiResponse({ status: 503, description: 'PAYMENTS_DISABLED.' })
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: FastifyRequest): Promise<WebhookAckResponseDto> {
    this.requireStripe();
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_MISSING',
        message: 'stripe-signature header missing',
      });
    }
    // The custom JSON parser in main.ts hands us a Buffer body for this
    // route (so signature verification has the exact bytes Stripe signed).
    const rawBody = req.body as unknown as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException({
        code: 'WEBHOOK_BODY_INVALID',
        message: 'webhook body must be raw bytes',
      });
    }
    const { eventId } = await this.handleWebhook.execute(rawBody, signature);
    return { received: true, eventId };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current Premium subscription for the calling user (or null).',
  })
  @ApiResponse({ status: 200, type: CurrentSubscriptionResponseDto })
  @Get('me/subscription')
  @HttpCode(HttpStatus.OK)
  async mySubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentSubscriptionResponseDto> {
    const row = await this.prisma.subscription.findFirst({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { subscription: null };
    return {
      subscription: {
        id: row.id,
        status: row.status,
        priceCents: row.priceCents,
        currency: row.currency,
        currentPeriodEnd: row.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      },
    };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mint a one-time Stripe Customer Portal URL for the caller.',
  })
  @ApiResponse({ status: 200, type: PortalUrlResponseDto })
  @ApiResponse({ status: 503, description: 'PAYMENTS_DISABLED.' })
  @Post('me/portal-url')
  @HttpCode(HttpStatus.OK)
  async portalUrl(@CurrentUser() user: AuthenticatedUser): Promise<PortalUrlResponseDto> {
    this.requireStripe();
    const row = await this.prisma.subscription.findFirst({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new ServiceUnavailableException({
        code: 'NO_SUBSCRIPTION',
        message: 'No subscription on file. Visit /pricing first.',
      });
    }
    const webBase = this.config.get('WEB_BASE_URL', { infer: true });
    const url = await this.payments!.getCustomerPortalUrl(
      row.stripeCustomerId,
      `${webBase}/account/billing`,
    );
    return { url };
  }
}
