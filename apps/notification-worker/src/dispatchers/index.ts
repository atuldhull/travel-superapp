/**
 * Channel router — picks the dispatcher per job's `channel`.
 *
 * Each dispatcher is constructed once at worker boot; the router
 * is stateless. When a dispatcher reports `enabled = false` (missing
 * provider config), the router logs + acks — $0 deploys keep working
 * without paid SaaS keys.
 *
 * Installed by [S-B1] of the S-series real-functionality closeout.
 */
import type { JobPayloads } from '@app/jobs';
import type { AppLogger } from '@app/logger';
import { EmailDispatcher } from './email.dispatcher';
import { PushDispatcher } from './push.dispatcher';
import { SmsDispatcher } from './sms.dispatcher';
import type { NotificationVars } from './types';

export interface DispatcherRouter {
  /**
   * Route + dispatch one job. Throws on transient errors (BullMQ retries);
   * returns void on success OR on graceful skip (no provider configured).
   */
  dispatch(payload: JobPayloads['notifications'], logger: AppLogger): Promise<void>;
  /** Snapshot of which channels are live; useful for the boot log. */
  status(): Record<JobPayloads['notifications']['channel'], boolean>;
}

export function buildDispatcherRouter(): DispatcherRouter {
  const email = new EmailDispatcher({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL ?? 'no-reply@travelsuperapp.local',
  });
  const sms = new SmsDispatcher({
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  });
  const push = new PushDispatcher({
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });

  return {
    async dispatch(payload, logger): Promise<void> {
      const vars = payload.vars as NotificationVars;
      const meta = { userId: payload.userId, channel: payload.channel, template: payload.template };
      let delivered: boolean;
      switch (payload.channel) {
        case 'email':
          delivered = await email.send(vars, logger);
          break;
        case 'sms':
          delivered = await sms.send(vars, logger);
          break;
        case 'push':
          delivered = await push.send(vars, logger);
          break;
        default: {
          // Exhaustive — the discriminated union above covers every channel.
          const _exhaustive: never = payload.channel;
          throw new Error(`unknown channel: ${_exhaustive as string}`);
        }
      }
      if (!delivered) {
        logger.info(
          meta,
          `notification skipped — ${payload.channel} dispatcher disabled (no provider config)`,
        );
      }
    },
    status(): Record<JobPayloads['notifications']['channel'], boolean> {
      return { email: email.enabled, sms: sms.enabled, push: push.enabled };
    },
  };
}
