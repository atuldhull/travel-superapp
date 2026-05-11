/**
 * POST.1 — 20 demo users covering every role + a few edge cases
 * (banned, soft-deleted, agent, premium). Passwords are uniform
 * `demo-password-min-12-chars-123` so anyone running the seed gets
 * a credentials table they can sign in with immediately.
 */

import type { UserRole } from '@prisma/client';

export interface DemoUser {
  /** Stable email (no run-id suffix — seed is now idempotent). */
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  /** Stamp non-null to soft-delete this user (V.UX.32 retention sweep target). */
  readonly deletedAt?: Date;
  /** Stamp non-null + provide reason to ban (V.UX.34). */
  readonly bannedAt?: Date;
  readonly banReason?: string;
  /** Pre-seed lastSeenAt so the welcome-back hero (V.UX.30) has data. */
  readonly lastSeenAt?: Date;
  readonly previousSeenAt?: Date;
  /** Mark onboarding complete so post-login lands on /trips not /onboarding. */
  readonly hasSeenOnboarding?: boolean;
}

export const DEMO_PASSWORD = 'demo-password-min-12-chars-123';

const today = new Date();
const daysAgo = (n: number): Date => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);

export const DEMO_USERS: readonly DemoUser[] = [
  // 1 platform admin (you log in as this to see /admin /compliance /ops)
  {
    email: 'admin@travel.local',
    displayName: 'Admin',
    role: 'admin',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
    previousSeenAt: daysAgo(1),
  },

  // 1 compliance officer (read-only audit + retention)
  {
    email: 'compliance@travel.local',
    displayName: 'Compliance Officer',
    role: 'compliance',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
    previousSeenAt: daysAgo(2),
  },

  // 1 SRE (read-only ops + force-purge)
  {
    email: 'sre@travel.local',
    displayName: 'Site Reliability',
    role: 'sre',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
    previousSeenAt: daysAgo(3),
  },

  // 4 verified agents (kyc=verified seeded separately in admin.ts)
  {
    email: 'agent.kenji@travel.local',
    displayName: 'Kenji Yamamoto',
    role: 'agent',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(1),
  },
  {
    email: 'agent.luisa@travel.local',
    displayName: 'Luísa Costa',
    role: 'agent',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(2),
  },
  {
    email: 'agent.sofia@travel.local',
    displayName: 'Sofía Ramírez',
    role: 'agent',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
  },
  {
    email: 'agent.pim@travel.local',
    displayName: 'Pim Sukhawat',
    role: 'agent',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(4),
  },

  // 1 premium user (concierge unlocked)
  {
    email: 'premium@travel.local',
    displayName: 'Pat Premium',
    role: 'premium',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
    previousSeenAt: daysAgo(45), // welcome-back hero fires (>30d)
  },

  // 1 main demo user — most trips + memory books attach to this one
  {
    email: 'demo@travel.local',
    displayName: 'Demo Traveler',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
    previousSeenAt: daysAgo(7),
  },

  // 8 regular travelers (varied seen-recently)
  {
    email: 'alice@travel.local',
    displayName: 'Alice Wong',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(1),
  },
  {
    email: 'bob@travel.local',
    displayName: 'Bob Martin',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(3),
  },
  {
    email: 'carol@travel.local',
    displayName: 'Carol Singh',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(2),
  },
  {
    email: 'dave@travel.local',
    displayName: 'Dave Patel',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(5),
  },
  {
    email: 'eve@travel.local',
    displayName: 'Eve Rodríguez',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(0),
  },
  {
    email: 'frank@travel.local',
    displayName: 'Frank Ng',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(6),
  },
  {
    email: 'grace@travel.local',
    displayName: 'Grace Tanaka',
    role: 'user',
    hasSeenOnboarding: true,
    lastSeenAt: daysAgo(1),
  },
  {
    email: 'henry@travel.local',
    displayName: 'Henry Owens',
    role: 'user',
    hasSeenOnboarding: false,
  }, // pre-onboarding

  // 2 banned (edge-case for /admin/users + /appeal)
  {
    email: 'banned1@travel.local',
    displayName: 'Banned For Spam',
    role: 'user',
    bannedAt: daysAgo(2),
    banReason: 'Repeated unsolicited promotion in trip notes.',
    hasSeenOnboarding: true,
  },
  {
    email: 'banned2@travel.local',
    displayName: 'Banned For Abuse',
    role: 'user',
    bannedAt: daysAgo(5),
    banReason: 'Verbal abuse toward another collaborator.',
    hasSeenOnboarding: true,
  },

  // 1 soft-deleted (V.UX.32 → V.UX.33 reactivation window)
  {
    email: 'deleted1@travel.local',
    displayName: 'Departed User',
    role: 'user',
    deletedAt: daysAgo(3), // 4 days remain in retention window
    hasSeenOnboarding: true,
  },
];

/** Stable lookup by email (used to attach trips/books/reviews). */
export function userByEmail(email: string): DemoUser {
  const u = DEMO_USERS.find((x) => x.email === email);
  if (!u) throw new Error(`unknown demo user: ${email}`);
  return u;
}
