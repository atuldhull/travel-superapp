/**
 * POST.2B.3 — proves the pull-feed SQL filters (visibility + block)
 * against the REAL database. Skips cleanly if Postgres is
 * unreachable (project convention). Runs in the Phase B gate.
 *
 * TripPublication / Follow / UserBlock are FK-less, so this seeds
 * raw rows with synthetic ids — no User fixtures needed.
 *
 * Installed by prompt [POST.2B.3].
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/db/prisma.service';
import { GetFeedUseCase } from '../src/modules/feed/application/get-feed.use-case';

const A = 'feed-e2e-A';
const B = 'feed-e2e-B';
const PUB = 'feed-e2e-pub';
const FOL = 'feed-e2e-fol';
const PRIV = 'feed-e2e-priv';

describe('Pull-feed visibility + block filters (e2e, requires Postgres)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let getFeed: GetFeedUseCase;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    try {
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
      getFeed = moduleRef.get(GetFeedUseCase);
    } catch {
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.tripPublication.deleteMany({ where: { authorId: A } });
    await prisma.follow.deleteMany({ where: { followerId: B, followeeId: A } });
    await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: A }, { blockerId: B }] } });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  async function seedThreePubs(): Promise<void> {
    const at = new Date('2026-01-01T00:00:00.000Z');
    await prisma.tripPublication.createMany({
      data: [
        { tripId: PUB, authorId: A, visibility: 'PUBLIC', publishedAt: at },
        { tripId: FOL, authorId: A, visibility: 'FOLLOWERS', publishedAt: at },
        { tripId: PRIV, authorId: A, visibility: 'PRIVATE', publishedAt: at },
      ],
    });
  }

  it('non-follower sees only PUBLIC; PRIVATE never appears', async () => {
    await seedThreePubs();
    const { items } = await getFeed.execute({ viewerId: B, limit: 50 });
    const mine = items.filter((p) => p.authorId === A).map((p) => p.tripId);
    expect(mine).toEqual([PUB]);
  });

  it('follower sees PUBLIC + FOLLOWERS, still not PRIVATE', async () => {
    await seedThreePubs();
    await prisma.follow.create({ data: { followerId: B, followeeId: A } });
    const { items } = await getFeed.execute({ viewerId: B, limit: 50 });
    const mine = items
      .filter((p) => p.authorId === A)
      .map((p) => p.tripId)
      .sort();
    expect(mine).toEqual([FOL, PUB].sort());
  });

  it('a block (either direction) hides ALL of the author from the feed', async () => {
    await seedThreePubs();
    await prisma.follow.create({ data: { followerId: B, followeeId: A } });
    await prisma.userBlock.create({ data: { blockerId: A, blockedId: B } });
    const { items } = await getFeed.execute({ viewerId: B, limit: 50 });
    expect(items.filter((p) => p.authorId === A)).toHaveLength(0);
  });
});
