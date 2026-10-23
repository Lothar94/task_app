export const AGENT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type AgentModel = (typeof AGENT_MODELS)[number];

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AgentEffort = (typeof EFFORT_LEVELS)[number];

/**
 * How the model and effort of an agent's runs are chosen:
 * - `fixed`: always the agent's `model` and `effort` (default, previous behaviour).
 * - `auto`: whoever invokes the agent (the delegating agent or the project manager) picks them per
 *   task according to its difficulty; the agent's `model` and `effort` are the fallback when the
 *   invoker picks none.
 */
export const MODEL_SELECTION_MODES = ['fixed', 'auto'] as const;
export type ModelSelectionMode = (typeof MODEL_SELECTION_MODES)[number];

/** Model and effort picked by the invoker of an `auto` agent for one task; null fields use the agent's. */
export interface RunModelChoice {
  model: AgentModel | null;
  effort: AgentEffort | null;
}

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
  /** `auto` lets the invoker choose model and effort per task; `model`/`effort` become the fallback. */
  modelSelection: ModelSelectionMode;
  allowedTools: string[];
  /** Skills the agent must use; empty means skills are disabled for it. */
  skills: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  /** Sampling temperature (AGENT_TEMPERATURE_RANGE); null uses the runtime default. */
  temperature: number | null;
  /** Cap on the output tokens of each model response (1..AGENT_MAX_OUTPUT_TOKENS); null uses the runtime default. */
  maxOutputTokens: number | null;
  /** Names of the MCP servers of the catalog (GET /api/agent-runtime) the agent may use. */
  mcpServers: string[];
  /** Disabled agents keep their history but cannot receive new tasks (see PUT /api/agents/:id/enabled). */
  enabled: boolean;
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
  /** Defaults to `fixed` when omitted (older clients and export files). */
  modelSelection?: ModelSelectionMode;
  allowedTools: string[];
  skills: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  /** Optional for older clients and export files: omitted means null. */
  temperature?: number | null;
  /** Optional for older clients and export files: omitted means null. */
  maxOutputTokens?: number | null;
  /** Optional for older clients and export files: omitted means []. */
  mcpServers?: string[];
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

/** Identifies an agent export file; checked on import so other JSON files are rejected. */
export const AGENT_EXPORT_FORMAT = 'agent-fleet/agents';
export const AGENT_EXPORT_VERSION = 1;

/**
 * A portable agent: its profile without ids, organization or timestamps. Collaborators are
 * referenced by name and only include agents present in the same export.
 */
export interface ExportedAgent extends AgentInput {
  collaborators: string[];
}

export interface AgentExportDto {
  format: typeof AGENT_EXPORT_FORMAT;
  version: typeof AGENT_EXPORT_VERSION;
  exportedAt: string;
  /** Name of the organization the agents were exported from. */
  organization: string;
  agents: ExportedAgent[];
}

/**
 * Body of `POST /api/organizations/:id/agents/export`. Without `agentIds` every agent of the
 * organization is exported; `includeCollaborators` adds, transitively, the agents they delegate to.
 */
export interface AgentExportRequest {
  agentIds?: string[];
  includeCollaborators?: boolean;
}

/**
 * What to do with an imported agent whose name already exists in the target organization:
 * `fail` rejects the whole import, `skip` keeps the existing agent (collaborator links to that
 * name point to it) and `rename` imports it under a free name such as `Name (2)`.
 */
export const AGENT_IMPORT_CONFLICT_STRATEGIES = ['fail', 'skip', 'rename'] as const;
export type AgentImportConflictStrategy = (typeof AGENT_IMPORT_CONFLICT_STRATEGIES)[number];

/** Upper bound on the agents a single import file may contain. */
export const MAX_IMPORTED_AGENTS = 200;

/**
 * Body of `POST /api/organizations/:id/agents/import`: the export file as is plus how to resolve
 * name conflicts (`fail` by default). The import is all or nothing.
 */
export interface AgentImportRequest {
  file: AgentExportDto;
  onConflict?: AgentImportConflictStrategy;
}

export interface AgentImportResultDto {
  /** Agents created, in file order, already linked to their collaborators. */
  imported: AgentDto[];
  /** Names from the file left out because an agent with that name already existed (`skip`). */
  skipped: string[];
  /** Agents imported under a different name (`rename`). */
  renamed: { from: string; to: string }[];
}

/** Inclusive bounds of `temperature`. */
export const AGENT_TEMPERATURE_RANGE = { min: 0, max: 1 } as const;
/** Upper bound of `maxOutputTokens`. */
export const AGENT_MAX_OUTPUT_TOKENS = 128000;
/** MCP server names: letters, digits, `_` and `-`, as in Claude Code's config. */
export const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_AGENT_MCP_SERVERS = 20;

/**
 * Body of `PUT /api/agents/:id/enabled` → AgentDto. Disabling never touches tasks already assigned;
 * while disabled the agent cannot be the assignee of a new task, a delegation or a proposal
 * (409 CONFLICT) and is left out of the collaborators listed to delegating agents.
 */
export interface AgentEnabledInput {
  enabled: boolean;
}

export const MCP_TRANSPORTS = ['stdio', 'http', 'sse'] as const;
export type McpTransport = (typeof MCP_TRANSPORTS)[number];

/**
 * An MCP server configured for the user (Claude Code's user config). Only its name and transport
 * are exposed: commands, URLs, env and headers may hold secrets and never leave the server.
 */
export interface McpServerDto {
  name: string;
  transport: McpTransport;
}

/** Agent settings the runtime honours; unsupported ones are rejected when non-null (400 VALIDATION). */
export interface AgentRuntimeSupportDto {
  temperature: boolean;
  maxOutputTokens: boolean;
}

/** `GET /api/agent-runtime`: what the agent sheet can edit. */
export interface AgentRuntimeInfoDto {
  supports: AgentRuntimeSupportDto;
  /** Catalog of MCP servers agents may be given, by name. */
  mcpServers: McpServerDto[];
}
