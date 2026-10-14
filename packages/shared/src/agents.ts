export const AGENT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type AgentModel = (typeof AGENT_MODELS)[number];

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AgentEffort = (typeof EFFORT_LEVELS)[number];

export const PERMISSION_MODES = ['dontAsk', 'acceptEdits', 'bypassPermissions'] as const;
export type AgentPermissionMode = (typeof PERMISSION_MODES)[number];

export interface AgentDto {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  description: string;
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  allowedTools: string[];
  /** Skills the agent must use; empty means skills are disabled for it. */
  skills: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  collaboratorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentInput {
  name: string;
  role: string;
  description: string;
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  allowedTools: string[];
  skills: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
}

export const DEFAULT_AGENT_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'];

/** Skill names follow the Agent Skills spec: lowercase letters, digits and single hyphens. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_AGENT_SKILLS = 20;

/** A skill installed for the user (`~/.claude/skills`) that agents can be told to use. */
export interface SkillDto {
  name: string;
  description: string;
}
