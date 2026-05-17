/**
 * List a user's diary entries (newest first), optionally scoped to a
 * trip. Limit is clamped 1–100.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { DiaryEntry } from '../domain/diary-entry.entity';
import { DIARY_REPOSITORY, type DiaryRepository } from './ports/diary.repository';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export interface ListDiaryEntriesQuery {
  readonly userId: string;
  readonly tripId?: string;
  readonly limit?: number;
}

@Injectable()
export class ListDiaryEntriesUseCase {
  constructor(@Inject(DIARY_REPOSITORY) private readonly diary: DiaryRepository) {}

  execute(q: ListDiaryEntriesQuery): Promise<readonly DiaryEntry[]> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, q.limit ?? DEFAULT_LIMIT));
    return this.diary.list({
      userId: q.userId,
      ...(q.tripId ? { tripId: q.tripId } : {}),
      limit,
    });
  }
}
