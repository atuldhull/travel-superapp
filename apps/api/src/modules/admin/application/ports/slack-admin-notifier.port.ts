/**
 * Port for posting admin-action summaries to a Slack channel via an
 * Incoming Webhook. Best-effort: the adapter MUST never throw upward —
 * the audit row landed regardless of whether ops got pinged.
 *
 * `SLACK_ADMIN_WEBHOOK_URL` env gate decides whether the adapter actually
 * posts; absent → no-op stub.
 *
 * Installed by [S-E6] of the S-series real-functionality closeout.
 */
export const SLACK_ADMIN_NOTIFIER = Symbol('SLACK_ADMIN_NOTIFIER');

export interface SlackAdminNotification {
  readonly actorId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly context: Record<string, unknown> | null;
}

export interface SlackAdminNotifierPort {
  /** True iff a webhook URL is configured. */
  readonly enabled: boolean;
  /**
   * Fire-and-forget post. Implementations MUST swallow every error —
   * call sites await this but never observe failures.
   */
  notify(payload: SlackAdminNotification): Promise<void>;
}
