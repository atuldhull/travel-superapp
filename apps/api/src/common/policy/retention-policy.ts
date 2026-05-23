/**
 * System retention policy — the soft-deleted-user retention window
 * the Account purge sweeper enforces and the Admin retention-stats
 * dashboard mirrors so the "scheduled for purge" count matches what
 * the next sweep tick will actually delete.
 *
 * Lives under `common/` (the shared-kernel tier, A3) rather than on
 * either module's barrel because BOTH `@app/account` and the Admin
 * compliance surface legitimately depend on it. Co-locating it on
 * the Account barrel (as B4 originally did) formed an account↔admin
 * module-load cycle via the barrel re-exports: get-retention-stats
 * imported the account barrel → which loaded account.module → which
 * loaded admin-ban-user.use-case → which imported the admin barrel
 * → cycle. Hoisting the constant to a no-dependencies leaf under
 * `common/` breaks the chain — both modules import from `common/`,
 * which depends on neither.
 *
 * Extracted by [C1] — circular-import bug hardening.
 */
export const DEFAULT_RETENTION_DAYS = 7;
