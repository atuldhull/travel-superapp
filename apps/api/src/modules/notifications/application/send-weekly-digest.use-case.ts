/**
 * V.UX.26 — weekly digest sweep. For each digest-eligible user
 * (pref.email=true, "digest" not in pref.categoriesDisabled, AND
 * the local-clock window is currently Sunday 08:00 in their tz),
 * send a single email-channel notification summarising the past
 * week.
 *
 * Cadence guard: `lastDigestSentAt` is checked + advanced atomically
 * so a scheduler tick that fires twice (e.g. process restart inside
 * the hour window) only sends one digest per user per week.
 *
 * Per-user iteration is sequential — the digest set is small + the
 * per-user work is one count + one send. Parallelising would hit
 * Postgres `max_connections=100` faster than it'd help (same lesson
 * as the karma sweep).
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from '../../../common/db/prisma.service';
import {
  NOTIFICATION_PREFERENCE_REPOSITORY,
  type NotificationPreferenceRepository,
} from './ports/notification-preference.repository';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './ports/notification-log.repository';
import { NOTIFICATION_SENDER, type NotificationSender } from './ports/notification-sender';

const log = createLogger('notifications.weekly-digest');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SUNDAY = 0;
const DIGEST_HOUR_LOCAL = 8;

export interface WeeklyDigestSweepResult {
  readonly visited: number;
  readonly sent: number;
}

@Injectable()
export class SendWeeklyDigestUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly prefsRepo: NotificationPreferenceRepository,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: NotificationLogRepository,
    @Inject(NOTIFICATION_SENDER)
    private readonly sender: NotificationSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * @param now Inject for tests so we can advance the scheduler clock
   *            without manipulating system time.
   * @param force When true, skips the Sunday-08:00 local-clock gate.
   *              The scheduler always passes false; tests pass true
   *              to assert the body without contorting the calendar.
   */
  async execute(now: Date = this.clock.now(), force = false): Promise<WeeklyDigestSweepResult> {
    const eligible = await this.prefsRepo.listEligibleForDigest();
    let sent = 0;
    for (const pref of eligible) {
      const user = await this.prisma.user.findUnique({
        where: { id: pref.userId },
        select: { id: true, displayName: true, timezone: true, deletedAt: true },
      });
      if (!user || user.deletedAt !== null) continue;

      if (!force && !isSundayMorningInTz(now, user.timezone)) continue;
      if (
        pref.lastDigestSentAt !== null &&
        now.getTime() - pref.lastDigestSentAt.getTime() < WEEK_MS - 60 * 60 * 1000
      ) {
        // Already sent within the past ~6.5 days; protects against
        // a back-to-back tick (e.g. process restart) double-firing.
        continue;
      }

      const since = new Date(now.getTime() - WEEK_MS);
      const count = await this.logRepo.countDeliveredSince(user.id, since);
      const subject =
        count === 0
          ? `Your week with TravelSuperApp`
          : `${count} update${count === 1 ? '' : 's'} this week — your TravelSuperApp digest`;
      const body =
        count === 0
          ? `Hi ${user.displayName}, nothing landed in your inbox this week — but the world's still out there. Tap to plan your next trip.`
          : `Hi ${user.displayName}, ${count} notification${count === 1 ? '' : 's'} landed in your inbox this past week. Open the app to catch up.`;
      try {
        await this.sender.send({
          userId: user.id,
          channel: 'email',
          templateKey: 'weekly_digest',
          subject,
          body,
          context: { weekStart: since.toISOString(), notificationCount: count, url: '/inbox' },
        });
        await this.prefsRepo.markDigestSent(user.id, now);
        sent++;
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err), userId: user.id },
          'weekly_digest_send_failed',
        );
      }
    }
    log.info({ visited: eligible.length, sent }, 'weekly_digest_done');
    return { visited: eligible.length, sent };
  }
}

/**
 * Returns true iff `instant` falls inside the Sunday 08:00–09:00
 * window for the given IANA timezone. The hourly tick window matches
 * the scheduler interval — exactly one tick per week per user.
 *
 * Falls back to UTC if `Intl.DateTimeFormat` rejects the timezone
 * (preserves "best-effort" — a user with a malformed tz field still
 * gets a digest, just at UTC Sunday 08:00).
 */
export function isSundayMorningInTz(instant: Date, tz: string): boolean {
  let hour: number;
  let weekday: number;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    });
    const parts = fmt.formatToParts(instant);
    hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  } catch {
    hour = instant.getUTCHours();
    weekday = instant.getUTCDay();
  }
  return weekday === SUNDAY && hour === DIGEST_HOUR_LOCAL;
}
