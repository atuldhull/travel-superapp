/**
 * Plain-data domain types for the Adventure Diary. No Nest/Prisma
 * imports (clean/hex: domain has zero outward deps).
 *
 * Installed for the adventure-diary feature (user-directed).
 */

export interface DiaryEntry {
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
}

export interface NewDiaryEntry {
  readonly userId: string;
  readonly tripId?: string | null;
  readonly title: string;
  readonly body: string;
  readonly mood?: string | null;
  readonly aiAssisted: boolean;
  readonly entryDate: Date;
}
