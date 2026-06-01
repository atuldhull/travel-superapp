/**
 * AE421 — sample data for the Mirror surface scaffold.
 *
 * The eventual integration calls `useAdminSosController*` for the
 * pulsing globe dots, `useAdminScamModerationController*` for the
 * report clusters, and a new admin/audit stream for the river.
 * Until each of those endpoints is shape-matched, this fixture set
 * gives the surface a believable visual story.
 */
import type { MirrorAuditRow, MirrorSOSEvent, MirrorScamCluster } from './mirror-globe';

export const SAMPLE_MIRROR_SOS: ReadonlyArray<MirrorSOSEvent> = Object.freeze([
  {
    id: 'sos-mumbai-001',
    lat: 19.0759,
    lng: 72.8776,
    severity: 4,
    raisedAt: new Date(Date.now() - 12_000).toISOString(),
    summary: 'Tourist medical event · Mumbai',
  },
  {
    id: 'sos-delhi-002',
    lat: 28.6139,
    lng: 77.209,
    severity: 5,
    raisedAt: new Date(Date.now() - 28_000).toISOString(),
    summary: 'Stranded traveller · Delhi',
  },
  {
    id: 'sos-goa-003',
    lat: 15.2993,
    lng: 74.124,
    severity: 2,
    raisedAt: new Date(Date.now() - 41_000).toISOString(),
    summary: 'Lost passport report · Goa',
  },
  {
    id: 'sos-leh-004',
    lat: 34.1526,
    lng: 77.5771,
    severity: 3,
    raisedAt: new Date(Date.now() - 52_000).toISOString(),
    summary: 'Altitude sickness · Leh',
  },
]);

export const SAMPLE_MIRROR_SCAM: ReadonlyArray<MirrorScamCluster> = Object.freeze([
  { id: 'scam-jaipur', lat: 26.9124, lng: 75.7873, reportCount: 14 },
  { id: 'scam-varanasi', lat: 25.3176, lng: 82.9739, reportCount: 9 },
  { id: 'scam-bangalore', lat: 12.9716, lng: 77.5946, reportCount: 22 },
  { id: 'scam-kolkata', lat: 22.5726, lng: 88.3639, reportCount: 5 },
]);

export const SAMPLE_MIRROR_AUDIT: ReadonlyArray<MirrorAuditRow> = Object.freeze([
  {
    id: 'audit-1',
    kind: 'mutation',
    emittedAt: new Date(Date.now() - 4_000).toISOString(),
    summary: 'admin@aether updated trip 0xa7c4 status → archived',
  },
  {
    id: 'audit-2',
    kind: 'sos',
    emittedAt: new Date(Date.now() - 9_000).toISOString(),
    summary: 'SOS raised by user 0x12d in Mumbai',
  },
  {
    id: 'audit-3',
    kind: 'scam',
    emittedAt: new Date(Date.now() - 18_000).toISOString(),
    summary: 'Scam report on stay 0xff9 (Jaipur cluster)',
  },
  {
    id: 'audit-4',
    kind: 'read',
    emittedAt: new Date(Date.now() - 23_000).toISOString(),
    summary: 'Admin viewed user 0x9ac payments history',
  },
  {
    id: 'audit-5',
    kind: 'admin-action',
    emittedAt: new Date(Date.now() - 32_000).toISOString(),
    summary: 'Refund approved on payment 0x4e1 (₹2,400)',
  },
  {
    id: 'audit-6',
    kind: 'mutation',
    emittedAt: new Date(Date.now() - 45_000).toISOString(),
    summary: 'Trip 0xb1c published to feed',
  },
]);
