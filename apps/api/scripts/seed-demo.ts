/**
 * POST.1 — demo-deploy seed script. Populates a fresh database with
 * realistic sample data so a smoke-tester / demo-viewer / dev-onboarder
 * sees a meaningful UX on first load instead of an empty inbox.
 *
 * Approach (changed in POST.1): direct PrismaClient writes, NOT
 * through the HTTP layer via app.inject. Reasons:
 *   1. Boots in 2s instead of 30s (no AppModule).
 *   2. Sidesteps the tsx-watch emitDecoratorMetadata bug that breaks
 *      RegisterUseCase DI at runtime.
 *   3. Idempotent — uses upsertByEmailHash semantics, so re-running
 *      doesn't double anything; only adds what's missing.
 *
 * PostGIS coordinates are inserted via $executeRaw with
 * ST_SetSRID(ST_MakePoint(...), 4326)::geography — same pattern the
 * e2e tests use (CLAUDE.md rule 11 still applies; the seed counts
 * as test infrastructure).
 *
 * Usage:
 *   pnpm --filter=api db:seed:demo         # additive (idempotent)
 *   pnpm --filter=api db:seed:demo:reset   # wipes demo rows + re-seeds
 *
 * Required env vars:
 *   DATABASE_URL, EMAIL_PEPPER (for emailHash); set via .env.local.
 *
 * What it loads (POST.1):
 *   • 20 users (1 admin + 1 compliance + 1 sre + 4 agents +
 *     1 premium + 1 demo + 8 regular + 2 banned + 1 soft-deleted)
 *   • 4 verified Agent profiles
 *   • 12 trips with first-day itineraries (8 cities)
 *   • 8 published memory books with 4-6 attached photos each
 *   • 30 reviews across 4 target types
 *   • 5 SOS events (2 active, 3 resolved)
 *   • 10 scam reports (4 verified, 6 pending)
 *   • 6 ban appeals (4 pending, 1 approved, 1 rejected)
 *   • 20 admin audit log entries
 *
 * Installed by prompt [POST.1].
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { hashPassword } from '@app/auth';

import { DEMO_USERS, DEMO_PASSWORD, type DemoUser } from './fixtures/users';
import { DEMO_TRIPS } from './fixtures/trips';
import { DEMO_BOOKS, assetsForBook } from './fixtures/memory-books';
import { DEMO_REVIEWS } from './fixtures/reviews';
import { DEMO_SOS, DEMO_SCAMS } from './fixtures/safety';
import { DEMO_AGENTS, DEMO_BAN_APPEALS, DEMO_AUDIT_LOGS } from './fixtures/admin';

const prisma = new PrismaClient();

const log = (...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log('[seed-demo]', ...args);
};

const RESET = process.argv.includes('--reset');

function emailHash(email: string): string {
  const pepper = process.env['EMAIL_PEPPER'];
  if (!pepper) throw new Error('EMAIL_PEPPER env var missing');
  return createHash('sha256')
    .update(pepper + email.toLowerCase(), 'utf8')
    .digest('hex');
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function wipeDemoRows(): Promise<void> {
  log('--reset: wiping demo rows...');
  // Find all demo-* users, then cascade.
  const demoEmails = DEMO_USERS.map((u) => u.email);
  const demoEmailHashes = demoEmails.map((e) => emailHash(e));
  const users = await prisma.user.findMany({
    where: { emailHash: { in: demoEmailHashes } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) {
    log('  no demo users found; nothing to wipe');
    return;
  }
  // AdminAuditLog references actor with SetNull; explicit delete
  // to keep the audit trail clean for re-seed.
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.banAppeal.deleteMany({ where: { userId: { in: ids } } });
  await prisma.helpfulVote.deleteMany({ where: { voterId: { in: ids } } });
  await prisma.userKarma.deleteMany({ where: { userId: { in: ids } } });
  await prisma.review.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.scamReport.deleteMany({ where: { reporterId: { in: ids } } });
  await prisma.sosEvent.deleteMany({ where: { userId: { in: ids } } });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.memoryBook.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.trip.deleteMany({ where: { userId: { in: ids } } });
  await prisma.agent.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  log(`  wiped ${ids.length} demo users + cascade`);
}

async function upsertUser(u: DemoUser): Promise<{ id: string; created: boolean }> {
  const hash = emailHash(u.email);
  const existing = await prisma.user.findUnique({ where: { emailHash: hash } });
  if (existing) {
    return { id: existing.id, created: false };
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const row = await prisma.user.create({
    data: {
      emailHash: hash,
      emailEncrypted: Buffer.from(u.email, 'utf8'),
      passwordHash,
      role: u.role,
      displayName: u.displayName,
      hasSeenOnboarding: u.hasSeenOnboarding ?? false,
      ...(u.lastSeenAt !== undefined ? { lastSeenAt: u.lastSeenAt } : {}),
      ...(u.previousSeenAt !== undefined ? { previousSeenAt: u.previousSeenAt } : {}),
      ...(u.bannedAt !== undefined ? { bannedAt: u.bannedAt } : {}),
      ...(u.banReason !== undefined ? { banReason: u.banReason } : {}),
      ...(u.deletedAt !== undefined ? { deletedAt: u.deletedAt } : {}),
    },
  });
  return { id: row.id, created: true };
}

async function seedTripsAndItineraries(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const t of DEMO_TRIPS) {
    const userId = usersByEmail.get(t.ownerEmail);
    if (!userId) continue;
    // Idempotency: same owner + same title = same trip.
    const existing = await prisma.trip.findFirst({ where: { userId, title: t.title } });
    if (existing) continue;

    // Insert via raw SQL for the PostGIS center column.
    const id = `cseed${Math.random().toString(36).slice(2, 18)}${Date.now().toString(36)}`;
    await prisma.$executeRaw`
      INSERT INTO "Trip" ("id", "userId", "title", "status", "center", "radiusKm",
                          "startsOn", "endsOn", "version", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, ${t.title}, ${t.status}::"TripStatus",
              ST_SetSRID(ST_MakePoint(${t.centerLng}, ${t.centerLat}), 4326)::geography,
              ${t.radiusKm}, ${t.startsOn ? new Date(t.startsOn) : null},
              ${t.endsOn ? new Date(t.endsOn) : null}, 1, NOW(), NOW())
    `;

    // One ItineraryDay (day 0) with the items.
    if (t.items.length > 0 && t.startsOn) {
      const day = await prisma.itineraryDay.create({
        data: {
          tripId: id,
          dayIndex: 0,
          date: new Date(t.startsOn),
          summary: 'Day 1 highlights',
        },
      });
      for (const item of t.items) {
        await prisma.itineraryItem.create({
          data: {
            dayId: day.id,
            position: item.position,
            ...(item.notes !== undefined ? { notes: item.notes } : {}),
          },
        });
        // Title isn't stored on ItineraryItem; the schema uses placeId
        // → Place.name. For demo we leave placeId null + put the title
        // into notes so /trips/[id] still has something to render.
        // (The ItineraryItem has no `title` column — this is intentional.)
      }
    }
    created++;
  }
  return created;
}

async function seedMemoryBooks(
  usersByEmail: Map<string, string>,
): Promise<{ books: number; assets: number }> {
  let books = 0;
  let assets = 0;
  for (const b of DEMO_BOOKS) {
    const userId = usersByEmail.get(b.ownerEmail);
    if (!userId) continue;
    const existing = await prisma.memoryBook.findFirst({
      where: { ownerId: userId, title: b.title },
    });
    if (existing) continue;

    const photos = assetsForBook(b);
    const coverS3Key = photos.length > 0 ? photos[0]!.url : null;

    const book = await prisma.memoryBook.create({
      data: {
        ownerId: userId,
        title: b.title,
        theme: b.theme,
        coverS3Key,
        publishedAt: new Date(),
      },
    });
    books++;

    for (const p of photos) {
      // s3KeyRaw is UNIQUE — make per-book key by prefixing with book id.
      const s3KeyRaw = `${book.id}/${p.photoId}`;
      await prisma.mediaAsset.create({
        data: {
          ownerId: userId,
          memoryBookId: book.id,
          kind: 'image',
          status: 'ready',
          s3KeyRaw,
          variants: {
            // For demo: persist the direct CDN URL in variants so the
            // public viewer can fall back to it when a presigned S3
            // URL isn't available. Real uploads would carry resized
            // PNG/WebP variants here.
            cdnUrl: p.url,
            credit: p.credit,
            unsplashId: p.photoId,
          } as Prisma.InputJsonValue,
          exifStripped: true,
          position: p.position,
          caption: p.caption,
        },
      });
      assets++;
    }
  }
  return { books, assets };
}

async function seedReviews(usersByEmail: Map<string, string>): Promise<number> {
  let posted = 0;
  for (const r of DEMO_REVIEWS) {
    const authorId = usersByEmail.get(r.authorEmail);
    if (!authorId) continue;
    // Idempotency: same author + same target id + same body = same review.
    const existing = await prisma.review.findFirst({
      where: { authorId, targetType: r.targetType, targetId: r.targetId, body: r.body },
    });
    if (existing) continue;
    await prisma.review.create({
      data: {
        authorId,
        targetType: r.targetType,
        targetId: r.targetId,
        rating: r.rating,
        body: r.body,
        language: r.language ?? 'en',
        verifiedBooking: false,
      },
    });
    posted++;
  }
  return posted;
}

async function seedSos(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const s of DEMO_SOS) {
    const userId = usersByEmail.get(s.reporterEmail);
    if (!userId) continue;
    const triggeredAt = daysAgo(s.triggeredDaysAgo);
    // Idempotency: same user + same trigger within ±5min of the
    // recomputed-per-run daysAgo timestamp. Wider window than 1 sec
    // because each run shifts Date.now() by tens of seconds.
    const windowMs = 5 * 60 * 1000;
    const existing = await prisma.sosEvent.findFirst({
      where: {
        userId,
        trigger: s.trigger,
        createdAt: {
          gte: new Date(triggeredAt.getTime() - windowMs),
          lte: new Date(triggeredAt.getTime() + windowMs),
        },
      },
    });
    if (existing) continue;
    const id = `cseed${Math.random().toString(36).slice(2, 18)}${Date.now().toString(36)}`;
    await prisma.$executeRaw`
      INSERT INTO "SosEvent" ("id", "userId", "trigger", "coordinates", "resolvedAt",
                               "resolutionNote", "createdAt")
      VALUES (${id}, ${userId}, ${s.trigger},
              ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography,
              ${s.resolvedDaysAgo === null ? null : daysAgo(s.resolvedDaysAgo)},
              ${s.resolutionNote ?? null}, ${triggeredAt})
    `;
    created++;
  }
  return created;
}

async function seedScams(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const s of DEMO_SCAMS) {
    const reporterId = usersByEmail.get(s.reporterEmail);
    if (!reporterId) continue;
    const reportedAt = daysAgo(s.daysAgo);
    const existing = await prisma.scamReport.findFirst({
      where: {
        reporterId,
        category: s.category,
        description: s.description,
      },
    });
    if (existing) continue;
    const id = `cseed${Math.random().toString(36).slice(2, 18)}${Date.now().toString(36)}`;
    await prisma.$executeRaw`
      INSERT INTO "ScamReport" ("id", "reporterId", "category", "severity",
                                 "description", "evidenceUrls", "verified",
                                 "coordinates", "createdAt", "updatedAt")
      VALUES (${id}, ${reporterId}, ${s.category}, ${s.severity}::"ScamSeverity",
              ${s.description}, ARRAY[]::text[], ${s.verified},
              ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography,
              ${reportedAt}, ${reportedAt})
    `;
    created++;
  }
  return created;
}

async function seedAgents(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const a of DEMO_AGENTS) {
    const userId = usersByEmail.get(a.userEmail);
    if (!userId) continue;
    const existing = await prisma.agent.findUnique({ where: { userId } });
    if (existing) continue;
    await prisma.agent.create({
      data: {
        userId,
        displayName: a.displayName,
        bio: a.bio,
        kycStatus: 'verified',
        verifiedAt: new Date(),
        languages: [...a.languages],
        regions: [...a.regions],
        ratingAverage: a.ratingAverage,
        ratingCount: a.ratingCount,
      },
    });
    created++;
  }
  return created;
}

async function seedBanAppeals(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const a of DEMO_BAN_APPEALS) {
    const userId = usersByEmail.get(a.userEmail);
    if (!userId) continue;
    const createdAt = daysAgo(a.daysAgo);
    const existing = await prisma.banAppeal.findFirst({
      where: { userId, body: a.body },
    });
    if (existing) continue;
    await prisma.banAppeal.create({
      data: {
        userId,
        emailHash: emailHash(a.userEmail),
        body: a.body,
        status: a.status,
        createdAt,
        updatedAt: createdAt,
      },
    });
    created++;
  }
  return created;
}

async function seedAuditLogs(usersByEmail: Map<string, string>): Promise<number> {
  let created = 0;
  for (const e of DEMO_AUDIT_LOGS) {
    const actorId = usersByEmail.get(e.actorEmail);
    if (!actorId) continue;
    // Resolve target email → id where applicable (user actions).
    let targetId = e.targetId;
    if (e.targetType === 'user' && targetId.includes('@')) {
      const tid = usersByEmail.get(targetId);
      if (tid) targetId = tid;
    }
    const createdAt = daysAgo(e.daysAgo);
    // Idempotency: same actor + target + action is sufficient for
    // demo seeds — fixtures don't include legitimate duplicates.
    // Within ±5min window to allow re-seed timestamp drift across
    // different `daysAgo` values that round to the same minute.
    const windowMs = 5 * 60 * 1000;
    const existing = await prisma.adminAuditLog.findFirst({
      where: {
        actorId,
        targetType: e.targetType,
        targetId,
        action: e.action,
        createdAt: {
          gte: new Date(createdAt.getTime() - windowMs),
          lte: new Date(createdAt.getTime() + windowMs),
        },
      },
    });
    if (existing) continue;
    await prisma.adminAuditLog.create({
      data: {
        actorId,
        targetType: e.targetType,
        targetId,
        action: e.action,
        ...(e.context !== undefined ? { context: e.context as Prisma.InputJsonValue } : {}),
        createdAt,
      },
    });
    created++;
  }
  return created;
}

function printCredentials(): void {
  log('');
  log('========================================');
  log('  DEMO CREDENTIALS — sign in at /login   ');
  log('========================================');
  log(`  Password (all users): ${DEMO_PASSWORD}`);
  log('');
  for (const u of DEMO_USERS) {
    const note =
      u.role !== 'user'
        ? `[${u.role}]`
        : u.bannedAt
          ? '[banned]'
          : u.deletedAt
            ? '[soft-deleted]'
            : '';
    log(`  ${u.email.padEnd(35)} ${note}`);
  }
  log('');
  log('  Recommended: log in as admin@travel.local to see /admin /compliance /ops.');
  log('========================================');
}

async function main(): Promise<void> {
  log(`mode: ${RESET ? 'reset (wipe + re-seed)' : 'additive (idempotent upsert)'}`);
  if (RESET) {
    await wipeDemoRows();
  }

  log('seeding users...');
  const usersByEmail = new Map<string, string>();
  let createdUsers = 0;
  for (const u of DEMO_USERS) {
    const { id, created } = await upsertUser(u);
    usersByEmail.set(u.email, id);
    if (created) createdUsers++;
  }
  log(`  users: +${createdUsers} (total registered: ${DEMO_USERS.length})`);

  const agents = await seedAgents(usersByEmail);
  log(`  agents: +${agents}`);

  const trips = await seedTripsAndItineraries(usersByEmail);
  log(`  trips: +${trips}`);

  const bookResult = await seedMemoryBooks(usersByEmail);
  log(`  memory books: +${bookResult.books} (assets: +${bookResult.assets})`);

  const reviews = await seedReviews(usersByEmail);
  log(`  reviews: +${reviews}`);

  const sos = await seedSos(usersByEmail);
  log(`  sos events: +${sos}`);

  const scams = await seedScams(usersByEmail);
  log(`  scam reports: +${scams}`);

  const appeals = await seedBanAppeals(usersByEmail);
  log(`  ban appeals: +${appeals}`);

  const audit = await seedAuditLogs(usersByEmail);
  log(`  admin audit logs: +${audit}`);

  log('');
  log('done.');
  printCredentials();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[seed-demo] FAILED:', message);
    if (err instanceof Error && err.stack) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
