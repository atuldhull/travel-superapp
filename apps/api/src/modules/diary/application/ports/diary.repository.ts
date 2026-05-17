/**
 * Persistence port for diary entries. Infra binds the Prisma adapter.
 *
 * Installed for the adventure-diary feature.
 */
import type { DiaryEntry, NewDiaryEntry } from '../../domain/diary-entry.entity';

export interface ListDiaryQuery {
  readonly userId: string;
  readonly tripId?: string;
  readonly limit: number;
}

export interface DiaryRepository {
  create(input: NewDiaryEntry): Promise<DiaryEntry>;
  list(query: ListDiaryQuery): Promise<readonly DiaryEntry[]>;
  findById(id: string, userId: string): Promise<DiaryEntry | null>;
}

export const DIARY_REPOSITORY = Symbol('DiaryRepository');
