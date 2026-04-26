/**
 * Mark the caller's `User.hasSeenOnboarding` flag as true.
 *
 * Idempotent: calling this on an already-onboarded user is a no-op
 * (the underlying repo `update` is unconditional and the column is
 * already true). Web client calls this from /onboarding's "Skip" /
 * "Generate" terminal steps; the post-login routing on the next
 * /auth/me sees the new value and stops bouncing to /onboarding.
 *
 * Installed by prompt [V.UX.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from './ports/user.repository';

@Injectable()
export class MarkOnboardingCompleteUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  execute(userId: string): Promise<void> {
    return this.users.markOnboardingComplete(userId);
  }
}
