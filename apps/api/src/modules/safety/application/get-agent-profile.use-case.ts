/**
 * V.UX.24 — caller-self read of the agent's Agent row. The web
 * `/agent/profile` page hits this on mount; on first load before
 * an admin has provisioned the user as an agent, returns 404 so
 * the UI can surface a clear "not yet onboarded" state instead of
 * synthesising an empty record.
 *
 * The `@Roles('agent','admin')` gate on the controller keeps this
 * a no-op for non-agent users; the 404 here only fires when the
 * user holds the agent role but has no Agent row yet (out-of-band
 * provisioning gap).
 *
 * Installed by prompt [V.UX.24].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { AgentProfile } from '../domain/agent-profile.entity';
import { AGENT_REPOSITORY, type AgentRepository } from './ports/agent.repository';

@Injectable()
export class GetAgentProfileUseCase {
  constructor(@Inject(AGENT_REPOSITORY) private readonly agents: AgentRepository) {}

  async execute(userId: string): Promise<AgentProfile> {
    const agent = await this.agents.findByUserId(userId);
    if (!agent) {
      throw new NotFoundError('Agent profile not found', { userId }, 'AGENT_PROFILE_NOT_FOUND');
    }
    return agent;
  }
}
