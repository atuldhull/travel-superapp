/**
 * Slack Incoming-Webhook adapter for admin-action notifications.
 *
 * Behaviour:
 *   - Reads `SLACK_ADMIN_WEBHOOK_URL` at construction. Absent → `enabled=false`;
 *     `notify()` is an immediate no-op (matches the dispatcher pattern
 *     from [S-B1]).
 *   - Wraps the fetch with `CircuitBreaker.exec(...)` from `@app/resilience`
 *     so a flaky Slack edge doesn't accumulate failures on the audit
 *     write path.
 *   - Best-effort: every error is logged + swallowed. Audit rows MUST
 *     land regardless of webhook health.
 *   - Action-tier filter: only "critical" actions (ban, dismiss_scam,
 *     delete_*, archive_*) ping. List actions / verify_scam don't.
 *
 * Installed by [S-E6] of the S-series real-functionality closeout.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { CLOCK, type Clock } from '@app/clock';
import { createLogger } from '@app/logger';
import { CircuitBreaker } from '@app/resilience';
import type {
  SlackAdminNotification,
  SlackAdminNotifierPort,
} from '../application/ports/slack-admin-notifier.port';

const log = createLogger('admin.slack-notifier');

/**
 * Actions that warrant a Slack ping. Read-only verbs (list / show) +
 * low-stakes verbs (verify_scam) stay quiet — Slack would drown in
 * noise. Anything that destroys data or restricts a user pings.
 */
const PING_ACTIONS: ReadonlySet<string> = new Set([
  'ban',
  'unban',
  'dismiss_scam',
  'delete_media',
  'delete_trip',
  'archive_trip',
  'promote_admin',
  'demote_admin',
  'resolve_sos',
  // [S-E5] agent KYC moderation
  'verify_agent',
  'reject_agent',
]);

@Injectable()
export class SlackAdminNotifierAdapter implements SlackAdminNotifierPort {
  private readonly webhookUrl: string | undefined;
  private readonly breaker: CircuitBreaker;

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(CLOCK) clock: Clock,
  ) {
    // `optionalUrl` schema → string | '' | undefined. Coerce blank to undefined.
    const raw = config.get('SLACK_ADMIN_WEBHOOK_URL', { infer: true });
    this.webhookUrl = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
    this.breaker = new CircuitBreaker({
      name: 'admin.slack-notifier',
      // Slack incoming webhooks are usually reliable; tight breaker so
      // a brief outage fast-fails rather than queuing on every audit.
      failureThreshold: 5,
      openMs: 60_000,
      clock,
    });
  }

  get enabled(): boolean {
    return this.webhookUrl !== undefined;
  }

  async notify(payload: SlackAdminNotification): Promise<void> {
    if (!this.webhookUrl) return;
    if (!PING_ACTIONS.has(payload.action)) return;

    const text = formatSlackText(payload);

    try {
      await this.breaker.exec(async () => {
        const res = await fetch(this.webhookUrl!, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          throw new Error(`slack webhook ${res.status}`);
        }
      });
    } catch (err) {
      // Never re-throw — audit row already landed; webhook is best-effort.
      log.warn({ err: (err as Error).message, action: payload.action }, 'slack notify failed');
    }
  }
}

function formatSlackText(payload: SlackAdminNotification): string {
  const actor = payload.actorId ?? '<system>';
  const ctx = payload.context ? truncateJson(payload.context, 280) : '';
  return `:lock: *${payload.action}* by \`${actor}\` on \`${payload.targetType}/${payload.targetId}\`${
    ctx ? `\n\`\`\`${ctx}\`\`\`` : ''
  }`;
}

function truncateJson(value: Record<string, unknown>, limit: number): string {
  const s = JSON.stringify(value);
  if (s.length <= limit) return s;
  return `${s.slice(0, limit - 1)}…`;
}
