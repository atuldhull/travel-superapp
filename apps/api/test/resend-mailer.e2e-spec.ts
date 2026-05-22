/**
 * POST.3 — ResendMailerAdapter integration test.
 *
 * Skipped when RESEND_API_KEY is absent (dev / CI without Resend
 * credentials). Provides confidence the real adapter constructs +
 * sends a message + handles error responses.
 *
 * NOT a real-email send (we don't want to bill Resend on every CI
 * run + leak addresses) — instead we mount the adapter, monkey-
 * patch its `client.emails.send` to a deterministic stub, and
 * assert the behavioural contract.
 */
import { ConfigService } from '@nestjs/config';
import { MailDeliveryError, ResendMailerAdapter } from '../src/common/mailer/resend-mailer.adapter';

const skip = !process.env['RESEND_API_KEY'];
const describeReal = skip ? describe.skip : describe;

describeReal('POST.3 — ResendMailerAdapter (integration, requires RESEND_API_KEY)', () => {
  function makeConfig(
    overrides: Record<string, string> = {},
  ): ConfigService<Record<string, unknown>, true> {
    const fake = {
      RESEND_API_KEY: process.env['RESEND_API_KEY'] ?? 'test-key',
      EMAIL_FROM_NAME: 'TravelSuperApp Test',
      EMAIL_FROM_ADDRESS: 'no-reply@example.com',
      ...overrides,
    } as Record<string, string>;
    return {
      get: (key: string) => fake[key],
    } as unknown as ConfigService<Record<string, unknown>, true>;
  }

  it('constructs the adapter from env vars', () => {
    const adapter = new ResendMailerAdapter(makeConfig());
    expect(adapter).toBeInstanceOf(ResendMailerAdapter);
  });

  it('throws if RESEND_API_KEY missing at construction time', () => {
    expect(() => new ResendMailerAdapter(makeConfig({ RESEND_API_KEY: '' }))).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it('wraps provider errors in MailDeliveryError', async () => {
    const adapter = new ResendMailerAdapter(makeConfig());
    // Monkey-patch the underlying client to simulate a Resend error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter as unknown as { client: { emails: { send: (...a: unknown[]) => unknown } } }).client =
      {
        emails: {
          send: async () => ({ data: null, error: { message: 'invalid from address' } }),
        },
      };

    await expect(
      adapter.send({
        to: 'test@example.com',
        subject: 'Test',
        textBody: 'Hello',
      }),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });

  it('treats successful send as resolve-without-throw', async () => {
    const adapter = new ResendMailerAdapter(makeConfig());
    (adapter as unknown as { client: { emails: { send: (...a: unknown[]) => unknown } } }).client =
      {
        emails: {
          send: async () => ({ data: { id: 'msg_abc123' }, error: null }),
        },
      };

    await expect(
      adapter.send({
        to: 'test@example.com',
        subject: 'Test',
        textBody: 'Hello',
      }),
    ).resolves.toBeUndefined();
  });
});
