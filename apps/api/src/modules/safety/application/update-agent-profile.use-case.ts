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
import { NotFoundError, ValidationError } from '@app/errors';
import type { AgentProfile } from '../domain/agent-profile.entity';
import {
  AGENT_REPOSITORY,
  type AgentRepository,
  type UpdateAgentProfileInput,
} from './ports/agent.repository';

const MAX_BIO_CHARS = 2000;
const MAX_DISPLAY_CHARS = 120;
const MAX_LIST = 20;
const MAX_ENTRY_CHARS = 40;

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
    if (cmd.displayName !== undefined) {
      const trimmed = cmd.displayName.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_DISPLAY_CHARS) {
        throw new ValidationError(
          `displayName must be 1..${MAX_DISPLAY_CHARS} chars`,
          { displayName: ['out of range'] },
          { len: trimmed.length },
          'INVALID_AGENT_DISPLAY_NAME',
        );
      }
    }
    if (cmd.bio !== undefined && cmd.bio !== null && cmd.bio.length > MAX_BIO_CHARS) {
      throw new ValidationError(
        `bio must be ≤ ${MAX_BIO_CHARS} chars`,
        { bio: ['too long'] },
        { len: cmd.bio.length },
        'INVALID_AGENT_BIO',
      );
    }
    for (const field of ['languages', 'regions'] as const) {
      const list = cmd[field];
      if (list === undefined) continue;
      if (list.length > MAX_LIST) {
        throw new ValidationError(
          `${field} must have ≤ ${MAX_LIST} entries`,
          { [field]: ['too many'] },
          { count: list.length },
          'INVALID_AGENT_LIST',
        );
      }
      for (const entry of list) {
        const t = entry.trim();
        if (t.length < 2 || t.length > MAX_ENTRY_CHARS) {
          throw new ValidationError(
            `each ${field} entry must be 2..${MAX_ENTRY_CHARS} chars`,
            { [field]: ['entry out of range'] },
            { entry, len: t.length },
            'INVALID_AGENT_LIST',
          );
        }
      }
    }

    const input: UpdateAgentProfileInput = { userId: cmd.userId };
    if (cmd.displayName !== undefined) {
      (
        input as { -readonly [K in keyof UpdateAgentProfileInput]: UpdateAgentProfileInput[K] }
      ).displayName = cmd.displayName.trim();
    }
    if (cmd.bio !== undefined) {
      (
        input as { -readonly [K in keyof UpdateAgentProfileInput]: UpdateAgentProfileInput[K] }
      ).bio = cmd.bio === null ? null : cmd.bio.trim();
    }
    if (cmd.languages !== undefined) {
      (
        input as { -readonly [K in keyof UpdateAgentProfileInput]: UpdateAgentProfileInput[K] }
      ).languages = cmd.languages.map((l) => l.trim());
    }
    if (cmd.regions !== undefined) {
      (
        input as { -readonly [K in keyof UpdateAgentProfileInput]: UpdateAgentProfileInput[K] }
      ).regions = cmd.regions.map((r) => r.trim());
    }

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
