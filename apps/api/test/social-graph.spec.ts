/**
 * POST.2B.1 — unit tests for the social graph + block gate.
 *
 * Pure/fake (no Postgres). Proves: self-follow rejected (422);
 * a blocked pair refuses follow AND vote (403 BLOCKED_INTERACTION)
 * via the shared assertNotBlocked gate wired alongside the existing
 * trip-access gate; follow/unfollow/block/unblock idempotent.
 * (Heart is anonymous → no actor → N/A by design; review uses the
 * same assertNotBlocked path proven here.)
 *
 * Installed by prompt [POST.2B.1].
 */
import { ForbiddenError, ValidationError } from '@app/errors';
import { InMemoryEventBus } from '@app/events';
import type { Follow } from '../src/modules/social/domain/follow.entity';
import type { UserBlock } from '../src/modules/social/domain/user-block.entity';
import type { FollowRepository } from '../src/modules/social/application/ports/follow.repository';
import type { BlockRepository } from '../src/modules/social/application/ports/block.repository';
import { FollowUseCase } from '../src/modules/social/application/follow.use-case';
import { UnfollowUseCase } from '../src/modules/social/application/unfollow.use-case';
import {
  BlockUserUseCase,
  assertNotBlocked,
} from '../src/modules/social/application/block-user.use-case';
import { UnblockUserUseCase } from '../src/modules/social/application/unblock-user.use-case';
import { CastVoteUseCase } from '../src/modules/social/application/cast-vote.use-case';
import type { VoteRepository } from '../src/modules/social/application/ports/vote.repository';
import type { TripRepository } from '../src/modules/trip/application/ports/trip.repository';
import type { TripShareRepository } from '../src/modules/trip/application/ports/trip-share.repository';

class FakeFollows implements FollowRepository {
  edges = new Set<string>();
  async follow(a: string, b: string): Promise<Follow> {
    this.edges.add(`${a}>${b}`);
    return { followerId: a, followeeId: b, createdAt: new Date(0) };
  }
  async unfollow(a: string, b: string): Promise<void> {
    this.edges.delete(`${a}>${b}`);
  }
  async exists(a: string, b: string): Promise<boolean> {
    return this.edges.has(`${a}>${b}`);
  }
  async countFollowers(b: string): Promise<number> {
    return [...this.edges].filter((e) => e.endsWith(`>${b}`)).length;
  }
  // Phase 5 (J2) — list seams. The unit suite below doesn't exercise
  // them; they exist so the fake still satisfies FollowRepository.
  async countFollowing(a: string): Promise<number> {
    return [...this.edges].filter((e) => e.startsWith(`${a}>`)).length;
  }
  async listFollowers(
    b: string,
    limit: number,
  ): Promise<readonly { userId: string; displayName: string; followedAt: Date }[]> {
    return [...this.edges]
      .filter((e) => e.endsWith(`>${b}`))
      .slice(0, limit)
      .map((e) => ({ userId: e.split('>')[0]!, displayName: 'fake', followedAt: new Date(0) }));
  }
  async listFollowing(
    a: string,
    limit: number,
  ): Promise<readonly { userId: string; displayName: string; followedAt: Date }[]> {
    return [...this.edges]
      .filter((e) => e.startsWith(`${a}>`))
      .slice(0, limit)
      .map((e) => ({ userId: e.split('>')[1]!, displayName: 'fake', followedAt: new Date(0) }));
  }
}

class FakeBlocks implements BlockRepository {
  edges = new Set<string>();
  async block(a: string, b: string): Promise<UserBlock> {
    this.edges.add(`${a}>${b}`);
    return { blockerId: a, blockedId: b, createdAt: new Date(0) };
  }
  async unblock(a: string, b: string): Promise<void> {
    this.edges.delete(`${a}>${b}`);
  }
  async existsBetween(a: string, b: string): Promise<boolean> {
    return this.edges.has(`${a}>${b}`) || this.edges.has(`${b}>${a}`);
  }
  // Phase 5 (J2) — the other party of every block edge touching `u`.
  async listBlockedUserIds(u: string): Promise<readonly string[]> {
    const ids = new Set<string>();
    for (const e of this.edges) {
      const [a, b] = e.split('>') as [string, string];
      if (a === u) ids.add(b);
      else if (b === u) ids.add(a);
    }
    return [...ids];
  }
}

describe('Follow / Block use-cases (POST.2B.1, unit)', () => {
  // J6 — FollowUseCase now publishes Social.UserFollowed; an
  // in-memory bus with no subscribers is a clean no-op for these
  // pure unit tests.
  const bus = new InMemoryEventBus();

  it('rejects self-follow with 422 CANNOT_FOLLOW_SELF', async () => {
    const uc = new FollowUseCase(new FakeFollows(), new FakeBlocks(), bus);
    await expect(uc.execute({ followerId: 'u1', followeeId: 'u1' })).rejects.toMatchObject({
      code: 'CANNOT_FOLLOW_SELF',
    });
    await expect(uc.execute({ followerId: 'u1', followeeId: 'u1' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuses follow when a block exists in EITHER direction (403)', async () => {
    const blocks = new FakeBlocks();
    await blocks.block('u2', 'u1'); // u2 blocked u1
    const uc = new FollowUseCase(new FakeFollows(), blocks, bus);
    await expect(uc.execute({ followerId: 'u1', followeeId: 'u2' })).rejects.toMatchObject({
      code: 'BLOCKED_INTERACTION',
    });
  });

  it('follow then unfollow is idempotent (no throw on repeats)', async () => {
    const follows = new FakeFollows();
    const fu = new FollowUseCase(follows, new FakeBlocks(), bus);
    const uu = new UnfollowUseCase(follows);
    await fu.execute({ followerId: 'a', followeeId: 'b' });
    await fu.execute({ followerId: 'a', followeeId: 'b' }); // repeat
    expect(follows.edges.has('a>b')).toBe(true);
    await uu.execute({ followerId: 'a', followeeId: 'b' });
    await uu.execute({ followerId: 'a', followeeId: 'b' }); // repeat
    expect(follows.edges.has('a>b')).toBe(false);
  });

  it('rejects self-block; block/unblock idempotent', async () => {
    const blocks = new FakeBlocks();
    const bu = new BlockUserUseCase(blocks);
    const ubu = new UnblockUserUseCase(blocks);
    await expect(bu.execute({ blockerId: 'x', blockedId: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await bu.execute({ blockerId: 'x', blockedId: 'y' });
    await bu.execute({ blockerId: 'x', blockedId: 'y' });
    expect(await blocks.existsBetween('x', 'y')).toBe(true);
    await ubu.execute({ blockerId: 'x', blockedId: 'y' });
    await ubu.execute({ blockerId: 'x', blockedId: 'y' });
    expect(await blocks.existsBetween('x', 'y')).toBe(false);
  });

  it('assertNotBlocked: symmetric — throws 403 either direction, passes otherwise', async () => {
    const blocks = new FakeBlocks();
    await blocks.block('p', 'q');
    await expect(assertNotBlocked(blocks, 'q', 'p')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assertNotBlocked(blocks, 'a', 'b')).resolves.toBeUndefined();
  });

  it('CastVoteUseCase refuses a blocked pair (guard alongside the access gate)', async () => {
    const blocks = new FakeBlocks();
    await blocks.block('owner', 'voter'); // owner blocked voter
    const votes = {
      upsert: async () => {
        throw new Error('should not reach the repo when blocked');
      },
    } as unknown as VoteRepository;
    // assertCanVote: not owner (findByIdForUser→null) but an active
    // share exists → access passes; then findById gives the owner.
    const trips = {
      findByIdForUser: async () => null,
      findById: async () => ({ id: 't1', userId: 'owner' }),
    } as unknown as TripRepository;
    const shares = {
      countActiveSharesForTrip: async () => 1,
    } as unknown as TripShareRepository;

    const uc = new CastVoteUseCase(votes, trips, shares, blocks);
    await expect(
      uc.execute({
        tripId: 't1',
        userId: 'voter',
        targetType: 'place',
        targetId: 'p1',
        value: 1,
      }),
    ).rejects.toMatchObject({ code: 'BLOCKED_INTERACTION' });
  });
});
