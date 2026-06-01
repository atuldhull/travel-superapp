/**
 * AE424 — sample data for the Mirror "Investigate user" palette
 * scaffold.
 *
 * The real palette calls `useAdminUsersControllerSearch` + a fan-out
 * over trip / review / payment / audit lookups. Until those endpoints
 * are shape-matched, this fixture set lets the palette demo the full
 * search → highlight → assemble → dashboard path.
 */
import type { MirrorInvestigation, MirrorUserSuggestion } from './mirror-investigate';

export const SAMPLE_MIRROR_USERS: ReadonlyArray<MirrorUserSuggestion> = Object.freeze([
  {
    id: 'u_a7c41e9b',
    displayName: 'Asha Verma',
    contextTag: '23 trips · Mumbai',
  },
  {
    id: 'u_b1c92d34',
    displayName: 'Vikrant Khanna',
    contextTag: '11 trips · Goa',
  },
  {
    id: 'u_d6f31a87',
    displayName: 'Aisha Roy',
    contextTag: '8 trips · Jaipur',
  },
  {
    id: 'u_e2810cf5',
    displayName: 'Maya Iyer',
    contextTag: '14 trips · Alleppey',
  },
  {
    id: 'u_9ac4f72d',
    displayName: 'Ravi Joshi',
    contextTag: '6 trips · Varanasi · flagged 2x',
  },
]);

/** Sample-investigation map. Real flow: as the operator selects a
 *  user, the palette would issue trip + review + payment + audit
 *  requests; here we just look them up in a frozen map. */
export const SAMPLE_MIRROR_INVESTIGATIONS: Readonly<Record<string, MirrorInvestigation>> =
  Object.freeze({
    u_a7c41e9b: {
      userId: 'u_a7c41e9b',
      displayName: 'Asha Verma',
      trips: 23,
      reviews: 41,
      payments: 19,
      auditMentions: 1,
      summary: 'Heavy traveller · all green · 1 admin note on refund request',
      lastAuditedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    u_b1c92d34: {
      userId: 'u_b1c92d34',
      displayName: 'Vikrant Khanna',
      trips: 11,
      reviews: 14,
      payments: 9,
      auditMentions: 0,
      summary: 'Casual traveller · no audit mentions',
      lastAuditedAt: null,
    },
    u_d6f31a87: {
      userId: 'u_d6f31a87',
      displayName: 'Aisha Roy',
      trips: 8,
      reviews: 7,
      payments: 6,
      auditMentions: 3,
      summary: 'Recently flagged · review-moderation queue · medium attention',
      lastAuditedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
    u_e2810cf5: {
      userId: 'u_e2810cf5',
      displayName: 'Maya Iyer',
      trips: 14,
      reviews: 22,
      payments: 11,
      auditMentions: 1,
      summary: 'Frequent reviewer · clean record',
      lastAuditedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    u_9ac4f72d: {
      userId: 'u_9ac4f72d',
      displayName: 'Ravi Joshi',
      trips: 6,
      reviews: 5,
      payments: 4,
      auditMentions: 8,
      summary: 'High-attention · 8 audit mentions · 2 scam reports pending',
      lastAuditedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
  });
