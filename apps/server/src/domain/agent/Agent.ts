import type { AgentEffort, AgentModel, AgentPermissionMode } from '@fleet/shared';
import { ValidationError } from '../errors/DomainError.js';
import { requireIntegerInRange, requireText } from '../shared/guards.js';

export const MAX_AGENT_TURNS = 500;

export interface AgentProfile {
  name: string;
  role: string;
  description: string;
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  allowedTools: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
}

export interface AgentSnapshot extends AgentProfile {
  id: string;
  collaboratorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Agent {
  private constructor(private state: AgentSnapshot) {}

  static create(id: string, profile: AgentProfile, now: Date): Agent {
    return new Agent({
      id,
      ...Agent.validateProfile(profile),
      collaboratorIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: AgentSnapshot): Agent {
    return new Agent({ ...snapshot, collaboratorIds: [...snapshot.collaboratorIds] });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get role(): string {
    return this.state.role;
  }

  get description(): string {
    return this.state.description;
  }

  get collaboratorIds(): readonly string[] {
    return this.state.collaboratorIds;
  }

  updateProfile(profile: AgentProfile, now: Date): void {
    this.state = { ...this.state, ...Agent.validateProfile(profile), updatedAt: now };
  }

  setCollaborators(collaboratorIds: string[], now: Date): void {
    if (collaboratorIds.includes(this.state.id)) {
      throw new ValidationError('An agent cannot collaborate with itself');
    }
    this.state = { ...this.state, collaboratorIds: [...new Set(collaboratorIds)], updatedAt: now };
  }

  removeCollaborator(collaboratorId: string, now: Date): void {
    if (!this.canDelegateTo(collaboratorId)) return;
    this.setCollaborators(
      this.state.collaboratorIds.filter((id) => id !== collaboratorId),
      now,
    );
  }

  canDelegateTo(agentId: string): boolean {
    return this.state.collaboratorIds.includes(agentId);
  }

  toSnapshot(): AgentSnapshot {
    return { ...this.state, collaboratorIds: [...this.state.collaboratorIds] };
  }

  private static validateProfile(profile: AgentProfile): AgentProfile {
    return {
      name: requireText(profile.name, 'name', 60),
      role: requireText(profile.role, 'role', 120),
      description: profile.description.trim(),
      instructions: requireText(profile.instructions, 'instructions'),
      model: profile.model,
      effort: profile.effort,
      allowedTools: [...new Set(profile.allowedTools.map((tool) => tool.trim()).filter(Boolean))],
      permissionMode: profile.permissionMode,
      maxTurns: requireIntegerInRange(profile.maxTurns, 'maxTurns', 1, MAX_AGENT_TURNS),
    };
  }
}
