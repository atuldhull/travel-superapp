/**
 * Port for the GDPR Art. 17 / DPDP §12 hard-delete sweep.
 *
 * The adapter wipes every `User` row with `deletedAt <= cutoff`.
 * Schema-level `onDelete: Cascade` on every user-scoped FK
 * (Trip, Session, MediaAsset, MemoryBook, NotificationLog,
 * Vote, Expense, Review, ScamReport, SosEvent, StayBooking,
 * Subscription, EscrowHold, Commission, Agent, LiveEvent,
 * UserOAuthIdentity, MfaBackupCode, Preferences, Device,
 * NotificationPreference) means the dependent rows wipe in the
 * same Postgres transaction — no orphans, no manual fan-out.
 *
 * Returns the count of users actually deleted. Callers log
 * this so an oncall can spot anomalies (sudden spike → user
 * outrage / mass account-delete; sudden zero → cron broken).
 *
 * Idempotent by construction: a stable `where` clause; running
 * twice in a row yields `0` on the second pass.
 *
 * Installed by prompt [IV.18.16.3].
 */
export interface AccountPurger {
  /**
   * Hard-deletes every soft-deleted user whose `deletedAt`
   * timestamp is at or before `cutoff`. Returns the count of
   * rows deleted (0 when no eligible rows).
   */
  purgeOlderThan(cutoff: Date): Promise<number>;
}

export const ACCOUNT_PURGER = Symbol('ACCOUNT_PURGER');
