import { AGENT_EXPORT_FORMAT, AGENT_EXPORT_VERSION, type AgentExportDto, type ExportedAgent } from '@fleet/shared';
import type { Agent } from '../../domain/agent/Agent.js';
import { ValidationError } from '../../domain/errors/DomainError.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireAgentsOfOrganization, requireOrganization } from '../shared/lookups.js';

export interface ExportAgentsInput {
  agentIds?: readonly string[];
  includeCollaborators: boolean;
}

export class ExportAgents {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly agents: AgentRepository,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string, input: ExportAgentsInput): AgentExportDto {
    const organization = requireOrganization(this.organizations, organizationId);
    const selected = this.selectAgents(organizationId, input.agentIds);
    const exported = input.includeCollaborators ? this.withCollaborators(selected) : selected;
    const namesById = new Map(exported.map((agent) => [agent.id, agent.name]));
    return {
      format: AGENT_EXPORT_FORMAT,
      version: AGENT_EXPORT_VERSION,
      exportedAt: this.clock.now().toISOString(),
      organization: organization.name,
      agents: exported.map((agent) => toExportedAgent(agent, namesById)),
    };
  }

  private selectAgents(organizationId: string, agentIds: readonly string[] | undefined): Agent[] {
    if (agentIds === undefined) return this.agents.findByOrganization(organizationId);
    if (agentIds.length === 0) throw new ValidationError('Select at least one agent to export');
    return requireAgentsOfOrganization(this.agents, organizationId, [...new Set(agentIds)]);
  }

  /** Breadth-first closure over collaborators, in discovery order; dangling ids are skipped. */
  private withCollaborators(selected: Agent[]): Agent[] {
    const found = new Map(selected.map((agent) => [agent.id, agent]));
    const pending = [...selected];
    for (let agent = pending.shift(); agent; agent = pending.shift()) {
      for (const collaboratorId of agent.collaboratorIds) {
        const collaborator = found.has(collaboratorId) ? null : this.agents.findById(collaboratorId);
        if (!collaborator) continue;
        found.set(collaborator.id, collaborator);
        pending.push(collaborator);
      }
    }
    return [...found.values()];
  }
}

/** Portable form of an agent: no ids or timestamps, collaborators by name and only inside the export. */
function toExportedAgent(agent: Agent, namesInExport: ReadonlyMap<string, string>): ExportedAgent {
  const { name, role, description, instructions, model, effort, allowedTools, skills, permissionMode, maxTurns } =
    agent.toSnapshot();
  const collaborators = agent.collaboratorIds.flatMap((id) => namesInExport.get(id) ?? []);
  return {
    name,
    role,
    description,
    instructions,
    model,
    effort,
    allowedTools: [...allowedTools],
    skills: [...skills],
    permissionMode,
    maxTurns,
    collaborators,
  };
}
