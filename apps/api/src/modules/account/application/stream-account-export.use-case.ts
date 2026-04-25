/**
 * NDJSON-streaming variant of the GDPR account export. Each line
 * is one envelope `{"type":"<section>","data":{...}}` followed by
 * `\n`. Power users with 10k+ notifications + lots of media get
 * a wire format that downstream tooling can parse line-by-line
 * instead of loading a single multi-MB JSON object.
 *
 * **Honest caveat about memory.** This use-case still calls the
 * existing `UserDataAggregator.aggregateForUser` under the hood,
 * which loads the full bundle into memory before we start emitting
 * lines. The wire-format win is real (clients can `pipe` + parse
 * line-by-line); the server-side memory profile is unchanged for
 * v1. A true cursor-based section-by-section streamer is queued
 * for v2, requiring per-section pagination on the aggregator port.
 *
 * Envelope types (one per line, in this order):
 *   - `metadata`                — once
 *   - `user`                    — once
 *   - `preferences`             — 0-or-1
 *   - `notification_preference` — 0-or-1
 *   - `agent_profile`           — 0-or-1
 *   - `<section>` × count       — one per row in each section
 *     (sessions, devices, oauth_identities, mfa_backup_codes,
 *      trips, itinerary_days, itinerary_items, trip_versions,
 *      trip_shares, scam_reports, sos_events, notification_logs,
 *      media_assets, memory_books, votes, expenses, reviews,
 *      dish_reports, stay_bookings, subscriptions, escrow_holds,
 *      commissions, live_events)
 *
 * Format invariant: every line is a single complete JSON object
 * terminated by `\n`. No trailing comma, no array wrapping. Empty
 * sections emit zero lines (NOT a `count: 0` envelope) — the
 * row-count is implicit in how many lines of that type the
 * client sees.
 *
 * Installed by prompt [IV.18.16.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '@app/errors';
import { USER_DATA_AGGREGATOR, type UserDataAggregator } from './ports/user-data-aggregator';

@Injectable()
export class StreamAccountExportUseCase {
  constructor(@Inject(USER_DATA_AGGREGATOR) private readonly agg: UserDataAggregator) {}

  /**
   * Returns an async generator of NDJSON-encoded strings, one per
   * line (`\n`-terminated). The controller wraps this in
   * `Readable.from(...)` and pipes to the response.
   */
  async *execute(userId: string): AsyncGenerator<string, void, void> {
    const bundle = await this.agg.aggregateForUser(userId);
    if (!bundle) throw new UserNotFoundError(userId);

    yield line('metadata', {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      userId,
    });

    yield line('user', bundle.identity.user);

    if (bundle.identity.preferences) {
      yield line('preferences', bundle.identity.preferences);
    }
    if (bundle.notificationPreference) {
      yield line('notification_preference', bundle.notificationPreference);
    }
    if (bundle.agentProfile) {
      yield line('agent_profile', bundle.agentProfile);
    }

    for (const row of bundle.identity.sessions.rows) yield line('session', row);
    for (const row of bundle.identity.devices.rows) yield line('device', row);
    for (const row of bundle.identity.oauthIdentities.rows) yield line('oauth_identity', row);
    for (const row of bundle.identity.mfaBackupCodes.rows) yield line('mfa_backup_code', row);
    for (const row of bundle.trips.rows) yield line('trip', row);
    for (const row of bundle.itineraryDays.rows) yield line('itinerary_day', row);
    for (const row of bundle.itineraryItems.rows) yield line('itinerary_item', row);
    for (const row of bundle.tripVersions.rows) yield line('trip_version', row);
    for (const row of bundle.tripShares.rows) yield line('trip_share', row);
    for (const row of bundle.scamReports.rows) yield line('scam_report', row);
    for (const row of bundle.sosEvents.rows) yield line('sos_event', row);
    for (const row of bundle.notificationLogs.rows) yield line('notification_log', row);
    for (const row of bundle.mediaAssets.rows) yield line('media_asset', row);
    for (const row of bundle.memoryBooks.rows) yield line('memory_book', row);
    for (const row of bundle.votes.rows) yield line('vote', row);
    for (const row of bundle.expenses.rows) yield line('expense', row);
    for (const row of bundle.reviews.rows) yield line('review', row);
    for (const row of bundle.dishReports.rows) yield line('dish_report', row);
    for (const row of bundle.stayBookings.rows) yield line('stay_booking', row);
    for (const row of bundle.subscriptions.rows) yield line('subscription', row);
    for (const row of bundle.escrowHolds.rows) yield line('escrow_hold', row);
    for (const row of bundle.commissions.rows) yield line('commission', row);
    for (const row of bundle.liveEvents.rows) yield line('live_event', row);
  }
}

function line(type: string, data: unknown): string {
  return `${JSON.stringify({ type, data })}\n`;
}
