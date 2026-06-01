/**
 * AE421 — pure helpers for the Mirror (admin forensics) surface.
 *
 * Per docs/aether/02-surfaces.md §9 Mirror: "Live SOS events render as
 * red dots on a globe, pulsing. Pending scam reports cluster
 * geographically; clusters bigger = more reports. The audit log
 * streams as a vertical river on the right edge; each row is a small
 * floating glyph that disappears after 60s."
 *
 * AE421 ships the data model + pure math for the globe + the audit-log
 * river. AE422 wires the R3F globe + drei sphere + audit-river overlay.
 * The eventual integration with `useAdmin*Controller*` hooks lands in
 * a b-slice once each surface knows its data shape.
 */

/** A live SOS event the operator should see as a pulsing red dot on
 *  the globe. */
export interface MirrorSOSEvent {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** SOS severity 1-5 — drives the dot radius + halo intensity. */
  readonly severity: number;
  /** ISO-8601 time the event was raised; used for ageing. */
  readonly raisedAt: string;
  /** Short copy for the audit-river spark. */
  readonly summary: string;
}

/** A pending scam-report cluster — geographically grouped by the
 *  back-end so the front-end doesn't have to bin per-frame. */
export interface MirrorScamCluster {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  /** Number of reports in this cluster — drives the disk size. */
  readonly reportCount: number;
}

/** A row in the audit-log river. Each row appears as a small glyph
 *  travelling downward; rows older than 60 s are pruned by the river
 *  component. */
export interface MirrorAuditRow {
  readonly id: string;
  /** Kind tag — `mutation` / `read` / `sos` / `scam` / `admin-action`.
   *  Drives the glyph colour + symbol. */
  readonly kind: string;
  /** ISO-8601 emit time — drives the river position. */
  readonly emittedAt: string;
  /** One-line copy shown on hover. */
  readonly summary: string;
}

/** Default river TTL (ms) — rows older than this are dropped. Per spec,
 *  the audit river fades each row after 60 s. */
export const MIRROR_AUDIT_RIVER_TTL_MS = 60_000;

/** Default globe radius (world units). Calibrated so the AE375
 *  surface-canvas camera at z=6 frames it comfortably. */
export const MIRROR_GLOBE_RADIUS = 2.4;

/** Project a (lat, lng) tuple onto a sphere of `radius` in world
 *  space. Pure: caller supplies the sphere radius; the helper handles
 *  the standard math.
 *
 *  Convention: x points "east of Greenwich", y points up (north pole
 *  at the top), z points "out of the screen at the equator at 0°
 *  longitude" so the globe reads naturally on Mercator-trained eyes. */
export function latLngToVec3(
  lat: number,
  lng: number,
  radius: number = MIRROR_GLOBE_RADIUS,
): readonly [number, number, number] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [0, 0, radius];
  const phi = ((90 - lat) * Math.PI) / 180; // polar angle (from north pole)
  const theta = ((lng + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

/** Per-SOS dot radius scaled by severity. 1 → 0.04 world units; 5 →
 *  0.16. Clamped at the ends so a server bug doesn't render a giant
 *  red blob on the operator's screen. */
export function sosDotRadius(severity: number): number {
  if (!Number.isFinite(severity)) return 0.04;
  const clamped = Math.max(1, Math.min(5, severity));
  return 0.04 + (clamped - 1) * 0.03;
}

/** Per-cluster disk radius scaled by report count. Square-root scale
 *  so a 100-report cluster doesn't dwarf a 10-report cluster by 10×. */
export function scamClusterRadius(reportCount: number): number {
  if (!Number.isFinite(reportCount) || reportCount <= 0) return 0.05;
  return Math.min(0.5, 0.05 + Math.sqrt(reportCount) * 0.025);
}

/** Filter the audit river to only the rows still within TTL. Pure so
 *  the river overlay can run this in `useMemo` on each render. */
export function liveAuditRows(
  rows: ReadonlyArray<MirrorAuditRow>,
  now: number = Date.now(),
  ttlMs: number = MIRROR_AUDIT_RIVER_TTL_MS,
): ReadonlyArray<MirrorAuditRow> {
  return rows.filter((r) => {
    const t = new Date(r.emittedAt).getTime();
    if (!Number.isFinite(t)) return false;
    return now - t <= ttlMs;
  });
}

/** Y coordinate (0..1) for the audit row in the river overlay.
 *  `0` = just emitted (top); `1` = about to fall off (bottom).
 *  Pure: caller passes the row + `now`; helper interpolates. */
export function auditRowYProgress(
  row: MirrorAuditRow,
  now: number = Date.now(),
  ttlMs: number = MIRROR_AUDIT_RIVER_TTL_MS,
): number {
  const t = new Date(row.emittedAt).getTime();
  if (!Number.isFinite(t)) return 1;
  const elapsed = now - t;
  if (elapsed <= 0) return 0;
  if (elapsed >= ttlMs) return 1;
  return elapsed / ttlMs;
}

/** Glyph colour per kind. Mutation = terracotta; read = paper; SOS
 *  = bright red; scam = ochre; admin-action = olive. Unknown kinds
 *  fall back to surface. */
export function auditGlyphColor(kind: string): string {
  switch (kind) {
    case 'mutation':
      return '#C2614A';
    case 'read':
      return '#F2E8D5';
    case 'sos':
      return '#E04A4A';
    case 'scam':
      return '#E8B777';
    case 'admin-action':
      return '#6E7B5C';
    default:
      return '#F2E8D5';
  }
}

/** Glyph symbol per kind — single ASCII char so React renders w/o
 *  needing an icon dependency. */
export function auditGlyphSymbol(kind: string): string {
  switch (kind) {
    case 'mutation':
      return '◆';
    case 'read':
      return '•';
    case 'sos':
      return '!';
    case 'scam':
      return '⚠';
    case 'admin-action':
      return '◉';
    default:
      return '·';
  }
}

/** True when the viewer role is allowed to see the Mirror surface.
 *  Phase 1 admin RBAC has roles `admin` + `superadmin`; both pass. */
export function isMirrorViewer(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}
