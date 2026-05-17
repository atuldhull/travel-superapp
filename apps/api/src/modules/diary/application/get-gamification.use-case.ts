/**
 * Read the user's gamification snapshot + decorate it with the full
 * badge catalog (earned + locked) so the UI renders the whole shelf
 * in one call.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { BADGE_CATALOG, type GamificationState } from '../domain/gamification';
import {
  GAMIFICATION_REPOSITORY,
  type GamificationRepository,
} from './ports/gamification.repository';

export interface BadgeView {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly earned: boolean;
}

export interface GamificationView extends GamificationState {
  readonly badges: readonly BadgeView[];
}

@Injectable()
export class GetGamificationUseCase {
  constructor(@Inject(GAMIFICATION_REPOSITORY) private readonly game: GamificationRepository) {}

  async execute(userId: string): Promise<GamificationView> {
    const snap = await this.game.snapshot(userId);
    const earned = new Set(snap.earnedBadgeKeys);
    return {
      totalPoints: snap.totalPoints,
      currentStreak: snap.currentStreak,
      longestStreak: snap.longestStreak,
      entryCount: snap.entryCount,
      aiAssistCount: snap.aiAssistCount,
      lastEntryOn: snap.lastEntryOn,
      badges: BADGE_CATALOG.map((b) => ({ ...b, earned: earned.has(b.key) })),
    };
  }
}
