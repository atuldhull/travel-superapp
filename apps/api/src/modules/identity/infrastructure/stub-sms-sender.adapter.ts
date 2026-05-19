/**
 * Stub SMS sender — logs every message via the project logger and
 * keeps the last 100 in an in-memory ring so dev + e2e can read the
 * code without a paid SMS provider. Always registered ($0, no key);
 * the TwilioSmsSenderAdapter supersedes it only when fully configured.
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type { SmsMessage, SmsSender } from '../application/ports/sms-sender.port';

const RING_CAPACITY = 100;
const ring: SmsMessage[] = [];

@Injectable()
export class StubSmsSenderAdapter implements SmsSender {
  private readonly logger: AppLogger = createLogger('stub-sms');

  async send(message: SmsMessage): Promise<void> {
    ring.push(message);
    if (ring.length > RING_CAPACITY) ring.shift();
    this.logger.info({ to: message.to, bodyLength: message.body.length }, 'stub_sms_send');
  }
}

/** Test/dev helper. Most recent stubbed SMS, or null. */
export function getLastStubSms(): SmsMessage | null {
  return ring.length === 0 ? null : (ring[ring.length - 1] ?? null);
}

/** Test helper. Clears the ring (call in beforeEach so tests don't leak). */
export function clearStubSms(): void {
  ring.length = 0;
}
