/**
 * V.UX.13 — in-memory stub for the ContactNotifier port. Pushes
 * every notification into a bounded ring buffer so e2e tests can
 * assert "Alice's SOS fanned out to her two trusted contacts"
 * without standing up Twilio. Same shape as `StubMailerAdapter`
 * (V.UX.2) — drop-in target for a real SMS adapter later.
 *
 * Installed by prompt [V.UX.13].
 */
import { Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import type {
  ContactNotifier,
  SosNotificationPayload,
} from '../application/ports/contact-notifier.port';

const log = createLogger('stub-contact-notifier');
const RING_CAP = 200;

@Injectable()
export class StubContactNotifierAdapter implements ContactNotifier {
  private readonly ring: SosNotificationPayload[] = [];

  async notify(payload: SosNotificationPayload): Promise<void> {
    this.ring.push(payload);
    while (this.ring.length > RING_CAP) this.ring.shift();
    log.info(
      {
        contactName: payload.contactName,
        sosEventId: payload.sosEventId,
        hasPhone: payload.phone !== null,
        hasEmail: payload.email !== null,
      },
      'sos_contact_notified',
    );
  }

  /** Test-only — not exposed via any port. */
  drain(): readonly SosNotificationPayload[] {
    return [...this.ring];
  }

  /** Test-only — not exposed via any port. */
  clear(): void {
    this.ring.length = 0;
  }
}
