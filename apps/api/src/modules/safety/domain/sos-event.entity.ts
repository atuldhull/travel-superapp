/**
 * Plain-data domain `SosEvent`. Mirrors the Prisma row minus the
 * PostGIS `coordinates` column. `trigger` is a free-form string so
 * new trigger modes (`fall_detected`, `geofence_exit`,
 * `manual_tap`, `voice_command`) don't need a schema migration.
 *
 * `resolvedAt` is null on create; flipping it (with an optional
 * note) is a separate write path. An unresolved event is "active"
 * — the UI/dashboard filters on that.
 *
 * Installed by prompt [IV.18.11.2].
 */
export interface SosEvent {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly createdAt: Date;
}
