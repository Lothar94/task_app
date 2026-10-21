import type { AgentImportConflictStrategy, AgentImportResultDto, AgentExportDto, ExportedAgent } from '@fleet/shared';
import { Agent } from '../../domain/agent/Agent.js';
import { ConflictError, ValidationError } from '../../domain/errors/DomainError.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGenerator } from '../ports/IdGenerator.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import { requireOrganization } from '../shared/lookups.js';
import { toAgentDto } from '../shared/dtos.js';

const MAX_NAME_LENGTH = 60;

export interface ImportAgentsInput {
  file: Pick<AgentExportDto, 'agents'>;
  onConflict: AgentImportConflictStrategy;
}

/** Imports an export file all or nothing: every agent is built and checked before anything is saved. */
export class ImportAgents {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly agents: AgentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(organizationId: string, { file, onConflict }: ImportAgentsInput): AgentImportResultDto {
    requireOrganization(this.organizations, organizationId);
    const entries = file.agents.map((agent) => ({ ...agent, name: agent.name.trim() }));
    this.ensureNamesAreUniqueInFile(entries);
    this.ensureCollaboratorsAreInFile(entries);
    const conflicts = entries.filter((entry) => this.agents.findByName(organizationId, entry.name));
    if (conflicts.length > 0 && onConflict === 'fail') {
      throw new ConflictError(
        `Agents already exist in this organization: ${conflicts.map((entry) => `"${entry.name}"`).join(', ')}`,
      );
    }

    const conflicting = new Set(conflicts.map((entry) => entry.name));
    const fileNames = new Set(entries.map((entry) => entry.name));
    const idByFileName = new Map<string, string>();
    const created: { agent: Agent; entry: ExportedAgent }[] = [];
    const skipped: string[] = [];
    const renamed: { from: string; to: string }[] = [];
    const now = this.clock.now();

    for (const entry of entries) {
      if (!conflicting.has(entry.name)) {
        created.push(this.build(organizationId, entry, entry.name, idByFileName, now));
        continue;
      }
      if (onConflict === 'skip') {
        skipped.push(entry.name);
        idByFileName.set(entry.name, this.agents.findByName(organizationId, entry.name)?.id ?? '');
        continue;
      }
      const to = this.freeName(organizationId, entry.name, fileNames);
      fileNames.add(to);
      renamed.push({ from: entry.name, to });
      created.push(this.build(organizationId, entry, to, idByFileName, now));
    }

    for (const { agent, entry } of created) {
      agent.setCollaborators(this.resolveCollaborators(entry, idByFileName), now);
    }
    const agents = created.map(({ agent }) => agent);
    this.agents.saveAll(agents);
    return { imported: agents.map(toAgentDto), skipped, renamed };
  }

  private ensureNamesAreUniqueInFile(entries: readonly ExportedAgent[]): void {
    const seen = new Set<string>();
    for (const { name } of entries) {
      if (seen.has(name)) throw new ValidationError(`The file contains the agent "${name}" more than once`);
      seen.add(name);
    }
  }

  private ensureCollaboratorsAreInFile(entries: readonly ExportedAgent[]): void {
    const fileNames = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      const unknown = entry.collaborators.find((raw) => !fileNames.has(raw.trim()));
      if (unknown !== undefined) throw new ValidationError(`"${entry.name}" lists the unknown collaborator "${unknown}"`);
    }
  }

  private build(
    organizationId: string,
    entry: ExportedAgent,
    name: string,
    idByFileName: Map<string, string>,
    now: Date,
  ): { agent: Agent; entry: ExportedAgent } {
    const { collaborators: _collaborators, ...profile } = entry;
    const agent = Agent.create(
      this.ids.next(),
      organizationId,
      { ...profile, modelSelection: profile.modelSelection ?? 'fixed', name },
      now,
    );
    idByFileName.set(entry.name, agent.id);
    return { agent, entry };
  }

  private resolveCollaborators(entry: ExportedAgent, idByFileName: ReadonlyMap<string, string>): string[] {
    return entry.collaborators.map((raw) => {
      const id = idByFileName.get(raw.trim());
      if (!id) throw new ValidationError(`"${entry.name}" lists the unknown collaborator "${raw}"`);
      return id;
    });
  }

  /** First "Name (n)", n >= 2, free in the organization and in the file; the base is cut to fit the name limit. */
  private freeName(organizationId: string, name: string, taken: ReadonlySet<string>): string {
    for (let n = 2; ; n++) {
      const suffix = ` (${n})`;
      const candidate = `${name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
      if (!taken.has(candidate) && !this.agents.findByName(organizationId, candidate)) return candidate;
    }
  }
}
