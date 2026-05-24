/**
 * `DiaryEntry` domain entity — Adventure Diary. No Nest/Prisma
 * imports (clean/hex: domain has zero outward deps).
 *
 * DDD refactor by [G4.4]: 4 invariants moved off
 * `CreateDiaryEntryUseCase`:
 *   D1 title 1..DIARY_MAX_TITLE chars (after trim)
 *   D2 body 1..DIARY_MAX_BODY chars (after trim)
 *   D3 mood ≤ DIARY_MAX_MOOD chars (after trim, or null)
 *   D4 entryDate parses to a valid Date
 *
 * The gamification award rule (`applyEntry`) stays in `gamification.ts`
 * (separate pure domain function with its own snapshot input shape).
 *
 * Installed for the adventure-diary feature; entity-ized by [G4.4].
 */
import { ValidationError } from '@app/errors';

export const DIARY_MAX_TITLE = 200;
export const DIARY_MAX_BODY = 20_000;
export const DIARY_MAX_MOOD = 40;

/** Input shape for `DiaryEntry.create()` — string `entryDate` because
 *  the controller hands us an ISO string; the factory parses it. */
export interface CreateDiaryEntryInput {
  readonly userId: string;
  readonly tripId?: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood?: string | null;
  readonly aiAssisted?: boolean;
  /** ISO date string (date-only ok). Optional — defaults to now. */
  readonly entryDate?: string;
}

/** Trimmed/coerced shape returned by `create()`, ready for repo. */
export interface NormalisedDiaryEntry {
  readonly userId: string;
  readonly tripId: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood: string | null;
  readonly aiAssisted: boolean;
  readonly entryDate: Date;
}

/** Row shape returned by the Prisma adapter. */
export interface DiaryEntryPersistenceRow {
  readonly id: string;
  readonly userId: string;
  readonly tripId: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood: string | null;
  readonly aiAssisted: boolean;
  readonly entryDate: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class DiaryEntry {
  readonly id: string;
  readonly userId: string;
  readonly tripId: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood: string | null;
  readonly aiAssisted: boolean;
  /** Date-only semantics — the adventure day this entry is about. */
  readonly entryDate: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: DiaryEntryPersistenceRow) {
    this.id = row.id;
    this.userId = row.userId;
    this.tripId = row.tripId;
    this.title = row.title;
    this.body = row.body;
    this.mood = row.mood;
    this.aiAssisted = row.aiAssisted;
    this.entryDate = row.entryDate;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a normalised payload ready for
   * `DiaryRepository.create()`. Throws `ValidationError` on D1-D4.
   *
   *   D1 title 1..DIARY_MAX_TITLE chars (after trim)
   *   D2 body 1..DIARY_MAX_BODY chars (after trim)
   *   D3 mood ≤ DIARY_MAX_MOOD chars (after trim) — empty becomes null
   *   D4 entryDate parses to a valid Date (or defaults to now)
   */
  static create(input: CreateDiaryEntryInput): NormalisedDiaryEntry {
    const title = input.title.trim();
    if (title.length === 0 || title.length > DIARY_MAX_TITLE) {
      throw new ValidationError(
        `Title must be 1–${DIARY_MAX_TITLE} characters`,
        { title: [`1–${DIARY_MAX_TITLE} characters`] },
        { length: title.length },
        'INVALID_DIARY_TITLE',
      );
    }
    const body = input.body.trim();
    if (body.length === 0 || body.length > DIARY_MAX_BODY) {
      throw new ValidationError(
        `Body must be 1–${DIARY_MAX_BODY} characters`,
        { body: [`1–${DIARY_MAX_BODY} characters`] },
        { length: body.length },
        'INVALID_DIARY_BODY',
      );
    }
    const mood = input.mood?.trim() || null;
    if (mood && mood.length > DIARY_MAX_MOOD) {
      throw new ValidationError(
        'Mood too long',
        { mood: [`at most ${DIARY_MAX_MOOD} characters`] },
        { length: mood.length },
        'INVALID_DIARY_MOOD',
      );
    }
    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      throw new ValidationError(
        'entryDate is not a valid date',
        { entryDate: ['must be an ISO date'] },
        { entryDate: input.entryDate },
        'INVALID_DIARY_DATE',
      );
    }
    return {
      userId: input.userId,
      tripId: input.tripId ?? null,
      title,
      body,
      mood,
      aiAssisted: input.aiAssisted === true,
      entryDate,
    };
  }

  /** Wrap a persisted row in a `DiaryEntry` instance. */
  static fromPersistence(row: DiaryEntryPersistenceRow): DiaryEntry {
    return new DiaryEntry(row);
  }
}

/** Back-compat alias — the prior `NewDiaryEntry` interface mirrored
 *  the repo's `create()` input. After [G4.4] the canonical shape is
 *  `NormalisedDiaryEntry` (entity output), but the repo port still
 *  imports `NewDiaryEntry` so we keep the name as a synonym. */
export type NewDiaryEntry = NormalisedDiaryEntry;
