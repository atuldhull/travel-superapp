/**
 * POST.7 — Twilio adapter for the ContactNotifier port.
 *
 * Wraps the official `twilio` SDK. Activated by the SafetyModule
 * factory only when `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` +
 * `TWILIO_FROM_NUMBER` are ALL set (partial config = factory falls
 * back to the stub adapter so the SOS fan-out keeps working).
 *
 * Behaviour:
 *   - Sends a single SMS per trusted contact with a short, panic-
 *     legible body: triggering name + reason + lat/lng + (optional)
 *     cancel link.
 *   - Falls back to email-only contacts: if the contact has no
 *     phone, the adapter logs a `sos_contact_email_only_skipped`
 *     line and returns — no SMS, no thrown error, no break in
 *     fan-out for the other contacts.
 *   - Cost guard: an in-memory counter caps deliveries at 50 SMS /
 *     day (per api-instance). Beyond the cap, sends are logged +
 *     skipped. This is the cheapest possible "stop bleeding money
 *     if SOS is somehow looped" rail; a multi-instance cap lives in
 *     Redis once we're at scale.
 *
 * The use-case calls `notify` once per contact in
 * `Promise.allSettled` — a single failure here MUST NOT stop the
 * other contacts from being notified.
 *
 * Installed by prompt [POST.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type {
  ContactNotifier,
  SosNotificationPayload,
} from '../application/ports/contact-notifier.port';

/** In-memory daily-budget guard. ~50 SMS/day is generous for a
 *  single user's SOS fan-out (3 contacts × maybe 2 trips/day) and
 *  cheap if it stops a runaway loop. */
const DAILY_SMS_CAP = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

interface TwilioClient {
  messages: {
    create(opts: {
      to: string;
      from: string;
      body: string;
    }): Promise<{ sid: string; status: string }>;
  };
}

@Injectable()
export class TwilioContactNotifierAdapter implements ContactNotifier {
  private readonly client: TwilioClient;
  private readonly fromNumber: string;
  private readonly logger: AppLogger = createLogger('safety.twilio');
  private dailyCount = 0;
  private dailyWindowStart = this.clock.nowMs();
  private readonly breaker: CircuitBreaker;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
    const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
    const from = config.get('TWILIO_FROM_NUMBER', { infer: true });
    if (!sid || !token || !from) {
      throw new Error(
        'TwilioContactNotifierAdapter requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Twilio = require('twilio') as (sid: string, token: string) => TwilioClient;
    this.client = Twilio(sid, token);
    this.fromNumber = from;
    this.breaker = new CircuitBreaker({
      name: 'twilio-sos',
      clock,
      failureThreshold: 5,
      openMs: 60_000,
      onTransition: (from2, to, name) =>
        this.logger.warn({ from: from2, to, name }, 'circuit_state_change'),
    });
  }

  async notify(payload: SosNotificationPayload): Promise<void> {
    if (!payload.phone) {
      this.logger.info(
        { contactName: payload.contactName, sosEventId: payload.sosEventId },
        'sos_contact_email_only_skipped',
      );
      return;
    }
    if (!this.checkAndTickDailyCap()) {
      this.logger.warn(
        {
          contactName: payload.contactName,
          sosEventId: payload.sosEventId,
          dailyCount: this.dailyCount,
          cap: DAILY_SMS_CAP,
        },
        'sos_twilio_daily_cap_exceeded_dropped',
      );
      return;
    }
    const body = this.composeSmsBody(payload);
    try {
      const result = await callExternal(
        () =>
          this.client.messages.create({
            to: payload.phone!,
            from: this.fromNumber,
            body,
          }),
        { breaker: this.breaker, timeoutMs: 10_000, label: 'twilio-sos.create' },
      );
      this.logger.info(
        {
          contactName: payload.contactName,
          sosEventId: payload.sosEventId,
          twilioMessageId: result.sid,
          status: result.status,
        },
        'sos_twilio_sms_sent',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { contactName: payload.contactName, sosEventId: payload.sosEventId, err: msg },
        'sos_twilio_sms_failed',
      );
      // Throw — Promise.allSettled at the caller logs each rejection
      // but continues with the other contacts.
      throw err;
    }
  }

  private composeSmsBody(p: SosNotificationPayload): string {
    const lat = p.lat.toFixed(4);
    const lng = p.lng.toFixed(4);
    return [
      `🆘 SOS from ${p.contactName ? `your contact (${p.contactName})` : 'TravelSuperApp'}:`,
      `${p.trigger} at ${lat},${lng}`,
      `Cancel if false alarm via the in-app banner.`,
    ].join(' ');
  }

  /** Roll the daily window. Returns `true` if this SMS is allowed
   *  to send (and increments the counter), `false` if we're over
   *  cap and the SMS should be dropped. */
  private checkAndTickDailyCap(): boolean {
    if (this.clock.nowMs() - this.dailyWindowStart >= DAY_MS) {
      this.dailyCount = 0;
      this.dailyWindowStart = this.clock.nowMs();
    }
    if (this.dailyCount >= DAILY_SMS_CAP) return false;
    this.dailyCount++;
    return true;
  }
}
