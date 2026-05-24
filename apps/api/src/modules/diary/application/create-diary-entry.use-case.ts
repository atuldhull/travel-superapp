/**
 * Create a diary entry and award gamification in one flow:
 *   1. validate + normalise input
 *   2. persist the entry
 *   3. read the user's gamification snapshot
 *   4. run the PURE `applyEntry` rule (points / streak / badges)
 *   5. persist the award (atomic DB unit, no network)
 *   6. return the entry + the gamification delta (so the UI can
 *      celebrate "+N points · streak · new badge")
 *
 * No prisma transaction spans steps 2 + 5 by design — they're
 * separate ports, and a rare crash between them only under-credits
 * (self-heals on the next entry); never wrap network in a txn
 * (CLAUDE.md #13) — there is none here anyway.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DiaryEntry } from '../domain/diary-entry.entity';
import { applyEntry, type GamificationState } from '../domain/gamification';
import { DIARY_REPOSITORY, type DiaryRepository } from './ports/diary.repository';
import {
  GAMIFICATION_REPOSITORY,
  type GamificationRepository,
} from './ports/gamification.repository';

export interface CreateDiaryEntryCommand {
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly tripId?: string | null;
  readonly mood?: string | null;
  readonly aiAssisted?: boolean;
  /** ISO date (date-only ok); defaults to now. */
  readonly entryDate?: string;
}

export interface CreateDiaryEntryResult {
  readonly entry: DiaryEntry;
  readonly gamification: GamificationState & {
    readonly pointsAwarded: number;
    readonly newlyEarnedBadges: readonly string[];
  };
}

@Injectable()
export class CreateDiaryEntryUseCase {
  constructor(
    @Inject(DIARY_REPOSITORY) private readonly diary: DiaryRepository,
    @Inject(GAMIFICATION_REPOSITORY) private readonly game: GamificationRepository,
  ) {}

  async execute(cmd: CreateDiaryEntryCommand): Promise<CreateDiaryEntryResult> {
    // Domain-side invariants + normalisation (D1-D4 — [G4.4]).
    const normalised = DiaryEntry.create(cmd);

    const entry = await this.diary.create(normalised);

    const snap = await this.game.snapshot(normalised.userId);
    const award = applyEntry(
      snap,
      {
        entryDate: normalised.entryDate,
        bodyLength: normalised.body.length,
        aiAssisted: normalised.aiAssisted,
        hasTrip: Boolean(normalised.tripId),
      },
      new Set(snap.earnedBadgeKeys),
    );

    await this.game.applyAward({
      userId: normalised.userId,
      next: award.next,
      newlyEarnedBadges: award.newlyEarnedBadges,
    });

    return {
      entry,
      gamification: {
        ...award.next,
        pointsAwarded: award.pointsAwarded,
        newlyEarnedBadges: award.newlyEarnedBadges,
      },
    };
  }
}
