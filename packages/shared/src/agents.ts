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
/** Applies to each part of a name: the skill and, for plugin skills, the plugin. */
export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_AGENT_SKILLS = 20;
/** Separates the plugin from the skill in plugin skills, as Claude Code does: `caveman:caveman`. */
export const PLUGIN_SKILL_SEPARATOR = ':';

const isValidSkillPart = (part: string) =>
  part.length <= MAX_SKILL_NAME_LENGTH && SKILL_NAME_PATTERN.test(part);

/** Splits `plugin:skill` into its parts; plain skills have no plugin. */
export function parseSkillName(name: string): { plugin: string | null; skill: string } {
  const separator = name.indexOf(PLUGIN_SKILL_SEPARATOR);
  if (separator === -1) return { plugin: null, skill: name };
  return { plugin: name.slice(0, separator), skill: name.slice(separator + 1) };
}

/** True for `skill` and `plugin:skill`, where both parts follow SKILL_NAME_PATTERN. */
export function isValidSkillName(name: string): boolean {
  const { plugin, skill } = parseSkillName(name);
  return isValidSkillPart(skill) && (plugin === null || isValidSkillPart(plugin));
}

/**
 * A skill installed for the user that agents can be told to use: from `~/.claude/skills`
 * (`plugin: null`) or from an installed and enabled Claude Code plugin (`name` is `plugin:skill`).
 */
export interface SkillDto {
  name: string;
  description: string;
  plugin: string | null;
}
