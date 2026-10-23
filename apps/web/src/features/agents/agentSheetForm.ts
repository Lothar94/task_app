import {
  AGENT_MAX_OUTPUT_TOKENS,
  type AgentDto,
  type AgentEffort,
  type AgentInput,
  type AgentModel,
  type AgentRuntimeInfoDto,
  type AgentRuntimeSupportDto,
  DEFAULT_AGENT_TOOLS,
} from '@fleet/shared';

/** What the sheet edits; the rest of the AgentInput is taken from the agent as is. */
export interface SheetValues {
  instructions: string;
  model: AgentModel;
  effort: AgentEffort;
  /** null uses the runtime default. */
  temperature: number | null;
  /** Raw input text; empty uses the runtime default. */
  maxOutputTokens: string;
  allowedTools: string[];
  mcpServers: string[];
}

export type SheetField = keyof SheetValues;
export type SheetEdits = Partial<SheetValues>;

/** Starting point when the user stops using the runtime default temperature. */
export const CUSTOM_TEMPERATURE_START = 1;

export const sheetValuesOf = (agent: AgentDto): SheetValues => ({
  instructions: agent.instructions,
  model: agent.model,
  effort: agent.effort,
  temperature: agent.temperature ?? null,
  maxOutputTokens: String(agent.maxOutputTokens ?? ''),
  allowedTools: agent.allowedTools,
  mcpServers: agent.mcpServers ?? [],
});

const sameItems = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

function sameValue(field: SheetField, a: SheetValues, b: SheetValues): boolean {
  const [left, right] = [a[field], b[field]];
  if (Array.isArray(left) && Array.isArray(right)) return sameItems(left, right);
  return left === right;
}

/** True when any edited value differs from the agent's (list order does not count). */
export function isSheetDirty(agent: AgentDto, values: SheetValues): boolean {
  const original = sheetValuesOf(agent);
  return (Object.keys(values) as SheetField[]).some((field) => !sameValue(field, original, values));
}

/** Spanish error for the max output tokens text, or null when valid (empty is valid). */
export function maxOutputTokensError(text: string): string | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > AGENT_MAX_OUTPUT_TOKENS) {
    return `Debe ser un entero entre 1 y ${AGENT_MAX_OUTPUT_TOKENS.toLocaleString('es-ES')}`;
  }
  return null;
}

const NO_SUPPORT: AgentRuntimeSupportDto = { temperature: false, maxOutputTokens: false };

/** Full AgentInput for PUT /api/agents/:id; settings the runtime does not support are sent as null. */
export function toSheetAgentInput(
  agent: AgentDto,
  values: SheetValues,
  supports: AgentRuntimeSupportDto = NO_SUPPORT,
): AgentInput {
  const maxOutputTokens = values.maxOutputTokens.trim() === '' ? null : Number(values.maxOutputTokens);
  return {
    name: agent.name,
    role: agent.role,
    description: agent.description,
    instructions: values.instructions,
    model: values.model,
    effort: values.effort,
    modelSelection: agent.modelSelection,
    allowedTools: values.allowedTools,
    skills: agent.skills,
    permissionMode: agent.permissionMode,
    maxTurns: agent.maxTurns,
    temperature: supports.temperature ? values.temperature : null,
    maxOutputTokens: supports.maxOutputTokens ? maxOutputTokens : null,
    mcpServers: values.mcpServers,
  };
}

const union = (...lists: string[][]) => [...new Set(lists.flat())];

/** Default tools first, then any other the agent already has. */
export const toolOptions = (agent: AgentDto) => union(DEFAULT_AGENT_TOOLS, agent.allowedTools);

export interface McpOption {
  name: string;
  /** Configured in the runtime catalog; otherwise the agent keeps a server that no longer exists. */
  available: boolean;
}

export function mcpOptions(agent: AgentDto, runtime: AgentRuntimeInfoDto | undefined): McpOption[] {
  const catalog = new Set((runtime?.mcpServers ?? []).map((server) => server.name));
  return union([...catalog], agent.mcpServers ?? []).map((name) => ({ name, available: catalog.has(name) }));
}

/** Toggles `item` keeping the order of `options`. */
export const toggleItem = (selected: string[], item: string, options: string[]) =>
  selected.includes(item)
    ? selected.filter((value) => value !== item)
    : options.filter((option) => option === item || selected.includes(option));

/** Fields whose server validation messages (`field: message`) are shown next to them. */
const INLINE_FIELDS: SheetField[] = [
  'instructions',
  'model',
  'effort',
  'temperature',
  'maxOutputTokens',
  'allowedTools',
  'mcpServers',
];

export interface SplitErrors {
  byField: Partial<Record<SheetField, string>>;
  /** Details that belong to no sheet field, shown at form level. */
  general: string[];
}

export function splitValidationDetails(details: string[]): SplitErrors {
  const result: SplitErrors = { byField: {}, general: [] };
  for (const detail of details) {
    const field = INLINE_FIELDS.find(
      (name) => detail.startsWith(`${name}:`) || detail.startsWith(`${name}.`),
    );
    if (field && !result.byField[field]) result.byField[field] = detail.slice(detail.indexOf(':') + 1).trim();
    else result.general.push(detail);
  }
  return result;
}
