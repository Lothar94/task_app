import {
  type AgentEffort,
  type AgentModel,
  type AgentPermissionMode,
  type ModelSelectionMode,
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_TEMPERATURE_RANGE,
  MAX_AGENT_MCP_SERVERS,
  MAX_AGENT_SKILLS,
  MCP_SERVER_NAME_PATTERN,
  AGENT_MODELS,
  EFFORT_LEVELS,
  MODEL_SELECTION_MODES,
  isValidSkillName,
  MAX_SKILL_NAME_LENGTH,
} from '@fleet/shared';
import { ConflictError, ValidationError } from '../errors/DomainError.js';
import { requireIntegerInRange, requireOneOf, requireText } from '../shared/guards.js';

export const MAX_AGENT_TURNS = 500;

export interface AgentProfile {
  name: string;
  role: string;
  description: string;
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  modelSelection: ModelSelectionMode;
  allowedTools: string[];
  skills: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  /** Omitted means null: the runtime default. */
  temperature?: number | null;
  /** Omitted means null: the runtime default. */
  maxOutputTokens?: number | null;
  /** Omitted means none. */
  mcpServers?: string[];
}

/** A validated profile: every optional setting resolved to its value. */
export type AgentSettings = Required<AgentProfile>;

export interface AgentSnapshot extends AgentSettings {
  id: string;
  organizationId: string;
  enabled: boolean;
  collaboratorIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Agent {
  private constructor(private state: AgentSnapshot) {}

  static create(id: string, organizationId: string, profile: AgentProfile, now: Date): Agent {
    return new Agent({
      id,
      organizationId,
      ...Agent.validateProfile(profile),
      enabled: true,
      collaboratorIds: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(snapshot: AgentSnapshot): Agent {
    return new Agent({
      ...snapshot,
      skills: [...snapshot.skills],
      mcpServers: [...snapshot.mcpServers],
      collaboratorIds: [...snapshot.collaboratorIds],
    });
  }

  get id(): string {
    return this.state.id;
  }

  get organizationId(): string {
    return this.state.organizationId;
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

  get modelSelection(): ModelSelectionMode {
    return this.state.modelSelection;
  }

  get skills(): readonly string[] {
    return this.state.skills;
  }

  get collaboratorIds(): readonly string[] {
    return this.state.collaboratorIds;
  }

  get enabled(): boolean {
    return this.state.enabled;
  }

  get temperature(): number | null {
    return this.state.temperature;
  }

  get maxOutputTokens(): number | null {
    return this.state.maxOutputTokens;
  }

  get mcpServers(): readonly string[] {
    return this.state.mcpServers;
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

  setEnabled(enabled: boolean, now: Date): void {
    if (this.state.enabled === enabled) return;
    this.state = { ...this.state, enabled, updatedAt: now };
  }

  /** Disabled agents keep their tasks but cannot receive new ones (409). */
  ensureCanReceiveTasks(): void {
    if (!this.state.enabled)
      throw new ConflictError(`"${this.state.name}" is disabled and cannot receive new tasks`);
  }

  canDelegateTo(agentId: string): boolean {
    return this.state.collaboratorIds.includes(agentId);
  }

  toSnapshot(): AgentSnapshot {
    return {
      ...this.state,
      skills: [...this.state.skills],
      mcpServers: [...this.state.mcpServers],
      collaboratorIds: [...this.state.collaboratorIds],
    };
  }

  private static validateProfile(profile: AgentProfile): AgentSettings {
    return {
      name: requireText(profile.name, 'name', 60),
      role: requireText(profile.role, 'role', 120),
      description: profile.description.trim(),
      instructions: requireText(profile.instructions, 'instructions'),
      model: requireOneOf(profile.model, 'model', AGENT_MODELS),
      effort: requireOneOf(profile.effort, 'effort', EFFORT_LEVELS),
      modelSelection: requireOneOf(profile.modelSelection, 'modelSelection', MODEL_SELECTION_MODES),
      allowedTools: [...new Set(profile.allowedTools.map((tool) => tool.trim()).filter(Boolean))],
      skills: normalizeSkills(profile.skills),
      permissionMode: profile.permissionMode,
      maxTurns: requireIntegerInRange(profile.maxTurns, 'maxTurns', 1, MAX_AGENT_TURNS),
      temperature: normalizeTemperature(profile.temperature),
      maxOutputTokens: normalizeMaxOutputTokens(profile.maxOutputTokens),
      mcpServers: normalizeMcpServers(profile.mcpServers ?? []),
    };
  }
}

function normalizeTemperature(temperature: number | null | undefined): number | null {
  if (temperature === null || temperature === undefined) return null;
  const { min, max } = AGENT_TEMPERATURE_RANGE;
  if (!Number.isFinite(temperature) || temperature < min || temperature > max) {
    throw new ValidationError(`temperature must be between ${min} and ${max}`);
  }
  return temperature;
}

function normalizeMaxOutputTokens(maxOutputTokens: number | null | undefined): number | null {
  if (maxOutputTokens === null || maxOutputTokens === undefined) return null;
  return requireIntegerInRange(maxOutputTokens, 'maxOutputTokens', 1, AGENT_MAX_OUTPUT_TOKENS);
}

function normalizeMcpServers(mcpServers: string[]): string[] {
  const unique = [...new Set(mcpServers.map((name) => name.trim()).filter(Boolean))];
  if (unique.length > MAX_AGENT_MCP_SERVERS) {
    throw new ValidationError(`An agent can use at most ${MAX_AGENT_MCP_SERVERS} MCP servers`);
  }
  const invalid = unique.find((name) => !MCP_SERVER_NAME_PATTERN.test(name));
  if (invalid !== undefined) {
    throw new ValidationError(
      `Invalid MCP server name "${invalid}": use letters, digits, "_" and "-", up to 64 characters`,
    );
  }
  return unique;
}

function normalizeSkills(skills: string[]): string[] {
  const unique = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
  if (unique.length > MAX_AGENT_SKILLS) {
    throw new ValidationError(`An agent can use at most ${MAX_AGENT_SKILLS} skills`);
  }
  for (const skill of unique) requireValidSkillName(skill);
  return unique;
}

function requireValidSkillName(skill: string): void {
  if (!isValidSkillName(skill)) {
    throw new ValidationError(
      `Invalid skill name "${skill}": use "skill" or "plugin:skill", each part with lowercase letters, digits and single hyphens, up to ${MAX_SKILL_NAME_LENGTH} characters`,
    );
  }
}
