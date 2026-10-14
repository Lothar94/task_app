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
  permissionMode: AgentPermissionMode;
  maxTurns: number;
}

export const DEFAULT_AGENT_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'];
