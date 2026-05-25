/**
 * Prisma adapter for `BackupCodeRepository`. Consume is the only
 * interesting path — it's the single operation where a race between
 * two login attempts presenting the same code matters. We use a
 * conditional `updateMany` that only matches rows with `usedAt =
 * null`; the returned count is 1 iff we won the race.
 *
 * Installed by prompt [III.13.2] part 5.
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from '../../../common/db/prisma.service';
import type { BackupCodeRepository } from '../application/ports/backup-code.repository';
import { generatePlaintextCode, hashBackupCode } from '../../../common/crypto/backup-code-hash';

@Injectable()
export class PrismaBackupCodeRepository implements BackupCodeRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async regenerate(userId: string, count: number): Promise<readonly string[]> {
    const plaintexts: string[] = [];
    const hashes = new Set<string>();
    // Collisions across a 32^8 space are astronomically unlikely but
    // we still de-dup defensively — and if a collision does happen,
    // just regenerate the colliding code.
    while (plaintexts.length < count) {
      const plain = generatePlaintextCode();
      const h = hashBackupCode(plain);
      if (hashes.has(h)) continue;
      hashes.add(h);
      plaintexts.push(plain);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({ where: { userId } });
      await tx.mfaBackupCode.createMany({
        data: plaintexts.map((plain) => ({
          userId,
          codeHash: hashBackupCode(plain),
        })),
      });
    });

    return plaintexts;
  }

  async consume(userId: string, plaintext: string): Promise<boolean> {
    const codeHash = hashBackupCode(plaintext);
    const now = this.clock.now();
    // Conditional update: marks used iff currently unused. Returns 1
    // on the race winner, 0 for late arrivals.
    const result = await this.prisma.mfaBackupCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: now },
    });
    return result.count === 1;
  }

  async countRemaining(userId: string): Promise<number> {
    return this.prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });
  }

  async clearAll(userId: string): Promise<void> {
    await this.prisma.mfaBackupCode.deleteMany({ where: { userId } });
  }
}
