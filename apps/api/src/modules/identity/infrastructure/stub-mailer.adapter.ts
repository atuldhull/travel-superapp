/**
 * Stub mailer — logs every message via the project logger and keeps
 * the last 100 in an in-memory ring buffer so dev tools and e2e
 * tests can grab the magic-link URL without an actual SMTP / Resend
 * round-trip. Always registered so dev / CI never depend on a paid
 * provider.
 *
 * To inspect outbound mail in dev:
 *   curl http://localhost:3000/api/v1/health   # confirm api alive
 *   # then trigger /auth/magic-link/request and tail the api log:
 *   #   pnpm --filter=api dev   ← will print "[stub-mailer] would send …"
 *
 * Tests pull the most recent message via `getLastStubMessage()`
 * (re-exported below) so they can assert subject/body and extract
 * the token URL.
 *
 * Installed by prompt [V.UX.2].
 */
import { Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import type { MailMessage, MailerPort } from '../application/ports/mailer.port';

const RING_CAPACITY = 100;
const ring: MailMessage[] = [];

@Injectable()
export class StubMailerAdapter implements MailerPort {
  private readonly logger: AppLogger = createLogger('stub-mailer');

  async send(message: MailMessage): Promise<void> {
    // Push to the ring buffer; drop the oldest when over capacity.
    ring.push(message);
    if (ring.length > RING_CAPACITY) ring.shift();
    this.logger.info(
      { to: message.to, subject: message.subject, bodyLength: message.textBody.length },
      'stub_mailer_send',
    );
  }
}

/** Test/dev helper. Returns the most recent stubbed message. */
export function getLastStubMessage(): MailMessage | null {
  return ring.length === 0 ? null : (ring[ring.length - 1] ?? null);
}

/** Test/dev helper. Returns all stubbed messages, oldest first. */
export function getAllStubMessages(): readonly MailMessage[] {
  return ring.slice();
}

/** Test helper. Clears the ring (call in beforeEach so tests don't leak). */
export function clearStubMessages(): void {
  ring.length = 0;
}
