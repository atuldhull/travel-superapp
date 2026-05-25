/**
 * POST.7 — TwilioContactNotifierAdapter integration tests.
 *
 * Skipped when TWILIO_ACCOUNT_SID is absent (dev / CI without
 * Twilio credentials). When the key IS set, exercises the adapter
 * against the real Twilio API. Use TEST credentials + the magic
 * `+15005550006` FROM number for zero-cost validation — the
 * adapter still gets a real provider response without delivering
 * actual SMS.
 *
 * Three tests:
 *   1. Constructs cleanly with all 3 env vars
 *   2. Missing TWILIO_FROM_NUMBER throws at construction
 *   3. Skips silently for email-only contacts (no phone)
 *
 * Live SMS-send tests are deliberately omitted — they'd burn a
 * provider call per CI run. The "skip email-only" test covers the
 * critical no-phone branch without touching the network.
 */
import { ConfigService } from '@nestjs/config';
import { SYSTEM_CLOCK } from '@app/clock';
import { TwilioContactNotifierAdapter } from '../src/modules/safety/infrastructure/twilio-contact-notifier.adapter';
import type { SosNotificationPayload } from '../src/modules/safety/application/ports/contact-notifier.port';

const skip = !process.env['TWILIO_ACCOUNT_SID'];
const describeReal = skip ? describe.skip : describe;

describeReal(
  'POST.7 — TwilioContactNotifierAdapter (integration, requires TWILIO_ACCOUNT_SID)',
  () => {
    function makeConfig(
      overrides: Record<string, string | undefined> = {},
    ): ConfigService<Record<string, unknown>, true> {
      const fake = {
        TWILIO_ACCOUNT_SID: process.env['TWILIO_ACCOUNT_SID'] ?? '',
        TWILIO_AUTH_TOKEN: process.env['TWILIO_AUTH_TOKEN'] ?? 'test-token',
        TWILIO_FROM_NUMBER: process.env['TWILIO_FROM_NUMBER'] ?? '+15005550006',
        ...overrides,
      };
      return {
        get: (key: string) => fake[key as keyof typeof fake],
      } as unknown as ConfigService<Record<string, unknown>, true>;
    }

    it('constructs cleanly with all 3 env vars', () => {
      const adapter = new TwilioContactNotifierAdapter(makeConfig(), SYSTEM_CLOCK);
      expect(adapter).toBeInstanceOf(TwilioContactNotifierAdapter);
    });

    it('throws when TWILIO_FROM_NUMBER is absent', () => {
      expect(
        () =>
          new TwilioContactNotifierAdapter(
            makeConfig({ TWILIO_FROM_NUMBER: undefined }),
            SYSTEM_CLOCK,
          ),
      ).toThrow(/TWILIO_FROM_NUMBER/);
    });

    it('skips silently for email-only contacts (no phone)', async () => {
      const adapter = new TwilioContactNotifierAdapter(makeConfig(), SYSTEM_CLOCK);
      // Monkey-patch the client so a regression that DOES try to call
      // Twilio shows up loudly.
      let sendCalls = 0;
      (adapter as unknown as { client: { messages: { create: unknown } } }).client = {
        messages: {
          create: async () => {
            sendCalls++;
            return { sid: 'SM_should_not_be_called', status: 'queued' };
          },
        },
      };
      const payload: SosNotificationPayload = {
        contactName: 'Alice',
        phone: null,
        email: 'alice@example.com',
        travelerUserId: 'user_test',
        trigger: 'manual',
        lat: 38.7223,
        lng: -9.1393,
        sosEventId: 'sos_test_123',
        triggeredAt: new Date(),
      };
      await expect(adapter.notify(payload)).resolves.toBeUndefined();
      expect(sendCalls).toBe(0);
    });
  },
);
