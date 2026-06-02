/**
 * Sample Mirror audit feed for the Aether mobile preview (Phase 4
 * AE556).
 *
 * Mirror is admin-only + data-heavy; until the route wires to the real
 * admin audit stream (operator-owed), the preview renders this synthetic
 * feed. The rows are built relative to "now" so they always read as live
 * (the audit river TTL is 60s — static ISO times would be filtered out
 * by `liveAuditRows` the moment they aged past the window).
 *
 * `buildSampleAuditRows(now)` returns `MirrorAuditRow[]` with
 * `emittedAt = now - ageSeconds * 1000`, covering every glyph kind
 * (mutation / read / sos / scam / admin-action) so the colour + symbol
 * tables are all exercised.
 */
import type { MirrorAuditRow } from '@app/aether-canvas-shared';

interface SampleAudit {
  readonly id: string;
  readonly kind: string;
  readonly ageSeconds: number;
  readonly summary: string;
}

const SAMPLE_AUDITS: ReadonlyArray<SampleAudit> = [
  { id: 'a-1', kind: 'mutation', ageSeconds: 2, summary: 'Trip "Leh 2026" itinerary reordered' },
  { id: 'a-2', kind: 'read', ageSeconds: 6, summary: 'Place detail fetched: Pangong Tso' },
  { id: 'a-3', kind: 'scam', ageSeconds: 11, summary: 'Scam report flagged near Anjuna market' },
  { id: 'a-4', kind: 'admin-action', ageSeconds: 18, summary: 'User promoted to editor role' },
  { id: 'a-5', kind: 'sos', ageSeconds: 24, summary: 'SOS beacon raised on Chang La pass' },
  { id: 'a-6', kind: 'read', ageSeconds: 31, summary: 'Memory book opened: Goa palm villa' },
  { id: 'a-7', kind: 'mutation', ageSeconds: 39, summary: 'Booking confirmed: Alleppey houseboat' },
  { id: 'a-8', kind: 'read', ageSeconds: 47, summary: 'Feed echo viewed: Hampi boulders' },
];

/** Build the sample audit rows relative to `now` (ms) so they read as
 *  live in the 60s river window. */
export function buildSampleAuditRows(now: number): MirrorAuditRow[] {
  return SAMPLE_AUDITS.map((a) => ({
    id: a.id,
    kind: a.kind,
    emittedAt: new Date(now - a.ageSeconds * 1000).toISOString(),
    summary: a.summary,
  }));
}
