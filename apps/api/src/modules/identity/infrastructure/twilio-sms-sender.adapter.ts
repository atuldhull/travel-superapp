/**
 * Twilio adapter for the SmsSender port (phone sign-in codes, B1).
 * Mirrors the safety module's Twilio adapter: dynamic-require the SDK
 * (kept out of the static graph until used), an in-memory daily cap
 * so a runaway loop can't bleed money, failures throw so the caller
 * can surface a generic error.
 *
 * The IdentityModule factory instantiates this ONLY when
 * TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER are all
 * set — otherwise the stub serves dev/CI ($0, no key).
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type { SmsMessage, SmsSender } from '../application/ports/sms-sender.port';

const DAILY_SMS_CAP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

interface TwilioClient {
  messages: {
    create(opts: { to: string; from: string; body: string }): Promise<{
      sid: string;
      status: string;
    }>;
  };
}

@Injectable()
export class TwilioSmsSenderAdapter implements SmsSender {
  private readonly client: TwilioClient;
  private readonly fromNumber: string;
  private readonly logger: AppLogger = createLogger('identity.twilio-sms');
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
        'TwilioSmsSenderAdapter requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Twilio = require('twilio') as (sid: string, token: string) => TwilioClient;
    this.client = Twilio(sid, token);
    this.fromNumber = from;
    // [O1] 5 fails / 60s open. Twilio errors are expensive (each
    // counts against the cost-cap); breaker shortcuts the spam.
    this.breaker = new CircuitBreaker({
      name: 'twilio-sms',
      clock,
      failureThreshold: 5,
      openMs: 60_000,
      onTransition: (from2, to, name) =>
        this.logger.warn({ from: from2, to, name }, 'circuit_state_change'),
    });
  }

  async send(message: SmsMessage): Promise<void> {
    if (!this.checkAndTickDailyCap()) {
      this.logger.warn(
        { dailyCount: this.dailyCount, cap: DAILY_SMS_CAP },
        'login_sms_daily_cap_exceeded_dropped',
      );
      return;
    }
    try {
      const result = await callExternal(
        () =>
          this.client.messages.create({
            to: message.to,
            from: this.fromNumber,
            body: message.body,
          }),
        { breaker: this.breaker, timeoutMs: 10_000, label: 'twilio-sms.create' },
      );
      this.logger.info({ twilioMessageId: result.sid, status: result.status }, 'login_sms_sent');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ err: msg }, 'login_sms_failed');
      throw err instanceof Error ? err : new Error(msg);
    }
  }

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
