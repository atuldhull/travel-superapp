/**
 * POST.1 — admin domain seed:
 *   • 4 verified Agent rows linking to the 4 agent users
 *   • 6 BanAppeal rows (4 pending, 1 approved, 1 rejected)
 *   • 20 AdminAuditLog rows spanning every action verb
 *
 * The audit-log entries reference target ids that may or may not
 * exist in this DB — the audit log is append-only and target rows
 * can be deleted independently. The admin page handles missing
 * targets gracefully.
 */

export interface DemoAgentProfile {
  /** Email of the user (must already be role=agent in DEMO_USERS). */
  readonly userEmail: string;
  readonly displayName: string;
  readonly bio: string;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
}

export const DEMO_AGENTS: readonly DemoAgentProfile[] = [
  {
    userEmail: 'agent.kenji@travel.local',
    displayName: 'Kenji Yamamoto',
    bio: 'Born-and-raised Tokyo guide. 8 years specialising in food + neighbourhood walks. JTGA-certified.',
    languages: ['en', 'ja'],
    regions: ['Tokyo', 'Yokohama', 'Kamakura'],
    ratingAverage: 4.8,
    ratingCount: 47,
  },
  {
    userEmail: 'agent.luisa@travel.local',
    displayName: 'Luísa Costa',
    bio: 'Lisbon-born art historian. Custom routes through Alfama, Chiado, and the miradouros.',
    languages: ['pt', 'en', 'es'],
    regions: ['Lisbon', 'Sintra', 'Cascais'],
    ratingAverage: 4.9,
    ratingCount: 31,
  },
  {
    userEmail: 'agent.sofia@travel.local',
    displayName: 'Sofía Ramírez',
    bio: 'CDMX local. Mezcal + art + Roma & Condesa neighbourhood specialist.',
    languages: ['es', 'en'],
    regions: ['Mexico City', 'Puebla', 'Cuernavaca'],
    ratingAverage: 4.7,
    ratingCount: 22,
  },
  {
    userEmail: 'agent.pim@travel.local',
    displayName: 'Pim Sukhawat',
    bio: 'Bangkok food + temple guide. 12 years. Speaks great English; dietary restrictions welcome.',
    languages: ['th', 'en'],
    regions: ['Bangkok', 'Ayutthaya', 'Chiang Mai'],
    ratingAverage: 4.6,
    ratingCount: 38,
  },
];

export interface DemoBanAppeal {
  /** User email of the banned account submitting the appeal. */
  readonly userEmail: string;
  readonly body: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly daysAgo: number;
}

export const DEMO_BAN_APPEALS: readonly DemoBanAppeal[] = [
  {
    userEmail: 'banned1@travel.local',
    body: 'I believe my account was banned in error. The notes flagged as "promotion" were links I shared with a friend who also has an account. Happy to clarify any of the trip notes if needed.',
    status: 'pending',
    daysAgo: 1,
  },
  {
    userEmail: 'banned1@travel.local',
    body: 'Following up on my earlier appeal — I have removed the links from my profile. Could a moderator review again? Thanks.',
    status: 'pending',
    daysAgo: 0,
  },
  {
    userEmail: 'banned2@travel.local',
    body: 'I was frustrated and the message was inappropriate. I have apologised to the person directly. Asking for a second chance.',
    status: 'pending',
    daysAgo: 3,
  },
  {
    userEmail: 'banned2@travel.local',
    body: 'Any update?',
    status: 'pending',
    daysAgo: 1,
  },
  {
    userEmail: 'banned1@travel.local',
    body: 'Original first appeal that was approved last month — keeping for the audit trail.',
    status: 'approved',
    daysAgo: 30,
  },
  {
    userEmail: 'banned2@travel.local',
    body: 'Earlier appeal rejected — repeated abuse pattern.',
    status: 'rejected',
    daysAgo: 14,
  },
];

export interface DemoAuditLog {
  /** Email of the admin actor (must match a DEMO_USERS entry, role=admin). */
  readonly actorEmail: string;
  readonly targetType: 'user' | 'scam_report' | 'sos' | 'media' | 'trip';
  /** Stable opaque target id — doesn't have to exist as a row. */
  readonly targetId: string;
  readonly action:
    | 'ban'
    | 'unban'
    | 'verify_scam'
    | 'dismiss_scam'
    | 'resolve_sos'
    | 'delete_media'
    | 'delete_trip'
    | 'archive_trip';
  readonly context?: Record<string, unknown>;
  readonly daysAgo: number;
}

export const DEMO_AUDIT_LOGS: readonly DemoAuditLog[] = [
  // bans + unbans
  {
    actorEmail: 'admin@travel.local',
    targetType: 'user',
    targetId: 'banned1@travel.local',
    action: 'ban',
    context: { reason: 'Repeated unsolicited promotion in trip notes.' },
    daysAgo: 2,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'user',
    targetId: 'banned2@travel.local',
    action: 'ban',
    context: { reason: 'Verbal abuse toward another collaborator.' },
    daysAgo: 5,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'user',
    targetId: 'demo-old-banned-1',
    action: 'ban',
    context: { reason: 'Spam' },
    daysAgo: 30,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'user',
    targetId: 'demo-old-banned-1',
    action: 'unban',
    daysAgo: 25,
  },

  // scam moderation
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-1',
    action: 'verify_scam',
    context: { verified: true },
    daysAgo: 12,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-2',
    action: 'verify_scam',
    context: { verified: true },
    daysAgo: 8,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-3',
    action: 'verify_scam',
    context: { verified: true },
    daysAgo: 5,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-4',
    action: 'verify_scam',
    context: { verified: true },
    daysAgo: 20,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-spam-1',
    action: 'dismiss_scam',
    daysAgo: 7,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'scam_report',
    targetId: 'demo-scam-spam-2',
    action: 'dismiss_scam',
    daysAgo: 3,
  },

  // sos
  {
    actorEmail: 'admin@travel.local',
    targetType: 'sos',
    targetId: 'demo-sos-1',
    action: 'resolve_sos',
    context: { note: 'User confirmed safe via SMS.' },
    daysAgo: 30,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'sos',
    targetId: 'demo-sos-2',
    action: 'resolve_sos',
    context: { note: 'Police report filed.' },
    daysAgo: 13,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'sos',
    targetId: 'demo-sos-3',
    action: 'resolve_sos',
    context: { note: 'Clinic visited.' },
    daysAgo: 7,
  },

  // trips
  {
    actorEmail: 'admin@travel.local',
    targetType: 'trip',
    targetId: 'demo-trip-spam-1',
    action: 'delete_trip',
    daysAgo: 10,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'trip',
    targetId: 'demo-trip-spam-2',
    action: 'delete_trip',
    daysAgo: 18,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'trip',
    targetId: 'demo-trip-old-1',
    action: 'archive_trip',
    daysAgo: 22,
  },

  // media
  {
    actorEmail: 'admin@travel.local',
    targetType: 'media',
    targetId: 'demo-media-takedown-1',
    action: 'delete_media',
    daysAgo: 4,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'media',
    targetId: 'demo-media-takedown-2',
    action: 'delete_media',
    daysAgo: 11,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'media',
    targetId: 'demo-media-takedown-3',
    action: 'delete_media',
    daysAgo: 16,
  },
  {
    actorEmail: 'admin@travel.local',
    targetType: 'media',
    targetId: 'demo-media-takedown-4',
    action: 'delete_media',
    daysAgo: 24,
  },
];
