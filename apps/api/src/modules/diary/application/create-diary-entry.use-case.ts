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
import { ValidationError } from '@app/errors';
import type { DiaryEntry } from '../domain/diary-entry.entity';
import { applyEntry, type GamificationState } from '../domain/gamification';
import { DIARY_REPOSITORY, type DiaryRepository } from './ports/diary.repository';
import {
  GAMIFICATION_REPOSITORY,
  type GamificationRepository,
} from './ports/gamification.repository';

const MAX_TITLE = 200;
const MAX_BODY = 20_000;
const MAX_MOOD = 40;

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
    const title = cmd.title.trim();
    const body = cmd.body.trim();
    if (title.length === 0 || title.length > MAX_TITLE) {
      throw new ValidationError(
        'Title must be 1–200 characters',
        { title: ['1–200 characters'] },
        { length: title.length },
        'INVALID_DIARY_TITLE',
      );
    }
    if (body.length === 0 || body.length > MAX_BODY) {
      throw new ValidationError(
        'Body must be 1–20000 characters',
        { body: ['1–20000 characters'] },
        { length: body.length },
        'INVALID_DIARY_BODY',
      );
    }
    const mood = cmd.mood?.trim() || null;
    if (mood && mood.length > MAX_MOOD) {
      throw new ValidationError(
        'Mood too long',
        { mood: [`at most ${MAX_MOOD} characters`] },
        { length: mood.length },
        'INVALID_DIARY_MOOD',
      );
    }
    const entryDate = cmd.entryDate ? new Date(cmd.entryDate) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      throw new ValidationError(
        'entryDate is not a valid date',
        { entryDate: ['must be an ISO date'] },
        { entryDate: cmd.entryDate },
        'INVALID_DIARY_DATE',
      );
    }
    const aiAssisted = cmd.aiAssisted === true;

    const entry = await this.diary.create({
      userId: cmd.userId,
      tripId: cmd.tripId ?? null,
      title,
      body,
      mood,
      aiAssisted,
      entryDate,
    });

    const snap = await this.game.snapshot(cmd.userId);
    const award = applyEntry(
      snap,
      {
        entryDate,
        bodyLength: body.length,
        aiAssisted,
        hasTrip: Boolean(cmd.tripId),
      },
      new Set(snap.earnedBadgeKeys),
    );

    await this.game.applyAward({
      userId: cmd.userId,
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
