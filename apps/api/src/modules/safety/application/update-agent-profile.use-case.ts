/**
 * V.UX.24 — partial update of the caller's Agent row. Editable
 * fields only: displayName, bio, languages, regions. KYC status +
 * `verifiedAt` + `kycProviderRef` are admin-only and never accepted
 * here.
 *
 * Light validation:
 *   - displayName 1..120 chars (Zod-trimmed at the controller).
 *   - bio ≤ 2000 chars; null clears.
 *   - languages / regions: each entry 2..40 chars, max 20 entries.
 *
 * Installed by prompt [V.UX.24].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { AgentProfile } from '../domain/agent-profile.entity';
import {
  AGENT_REPOSITORY,
  type AgentRepository,
  type UpdateAgentProfileInput,
} from './ports/agent.repository';

export interface UpdateAgentProfileCommand {
  readonly userId: string;
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly languages?: readonly string[];
  readonly regions?: readonly string[];
}

@Injectable()
export class UpdateAgentProfileUseCase {
  constructor(@Inject(AGENT_REPOSITORY) private readonly agents: AgentRepository) {}

  async execute(cmd: UpdateAgentProfileCommand): Promise<AgentProfile> {
    // Domain-side invariants + trim/coerce (A1-A4 — [G4.2]).
    const patch = AgentProfile.validateUpdate({
      ...(cmd.displayName !== undefined ? { displayName: cmd.displayName } : {}),
      ...(cmd.bio !== undefined ? { bio: cmd.bio } : {}),
      ...(cmd.languages !== undefined ? { languages: cmd.languages } : {}),
      ...(cmd.regions !== undefined ? { regions: cmd.regions } : {}),
    });

    const input: UpdateAgentProfileInput = { userId: cmd.userId, ...patch };
    const updated = await this.agents.updateForUser(input);
    if (!updated) {
      throw new NotFoundError(
        'Agent profile not found',
        { userId: cmd.userId },
        'AGENT_PROFILE_NOT_FOUND',
      );
    }
    return updated;
  }
}
