/**
 * SMS dispatcher — Twilio SDK wrapper.
 *
 * Reads `to / body` from the job's `vars` map. When the TWILIO_* env
 * tuple is incomplete (any of SID, AUTH_TOKEN, FROM_NUMBER missing),
 * the dispatcher reports `enabled = false` and the router logs +
 * acks — $0 deploys keep working.
 *
 * Installed by [S-B1] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import type { Twilio } from 'twilio';
import twilioClient from 'twilio';
import type { AppLogger } from '@app/logger';
import type { NotificationVars } from './types';

export interface SmsDispatcherOptions {
  accountSid: string | undefined;
  authToken: string | undefined;
  fromNumber: string | undefined;
}

export class SmsDispatcher {
  private readonly client: Twilio | null;
  private readonly from: string;
  private readonly breaker: CircuitBreaker;

  constructor(opts: SmsDispatcherOptions) {
    if (opts.accountSid && opts.authToken && opts.fromNumber) {
      this.client = twilioClient(opts.accountSid, opts.authToken);
      this.from = opts.fromNumber;
    } else {
      this.client = null;
      this.from = '';
    }
    this.breaker = new CircuitBreaker({
      name: 'notification-worker:twilio',
      failureThreshold: 5,
      openMs: 30_000,
      clock: SYSTEM_CLOCK,
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async send(vars: NotificationVars, logger: AppLogger): Promise<boolean> {
    if (!this.client) return false;

    const to = strOrUndef(vars.to);
    const body = strOrUndef(vars.body) ?? strOrUndef(vars.text);

    if (!to || !body) {
      throw new Error(`sms payload missing required fields: to=${!!to} body=${!!body}`);
    }

    const response = await this.breaker.exec(async () =>
      this.client!.messages.create({ from: this.from, to, body }),
    );

    logger.info({ to, sid: response.sid, status: response.status }, 'sms sent');
    return true;
  }
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
