import { type AgentDto, type AgentInput, DEFAULT_AGENT_TOOLS } from '@fleet/shared';

export interface AgentFormValues extends Omit<AgentInput, 'allowedTools'> {
  allowedTools: string;
  collaboratorIds: string[];
  /** Extra requests for Claude when drafting the instructions; not stored with the agent. */
  instructionsGuidance: string;
}

export const EMPTY_AGENT_FORM: AgentFormValues = {
  name: '',
  role: '',
  description: '',
  instructions: '',
  model: 'sonnet',
  effort: 'high',
  allowedTools: DEFAULT_AGENT_TOOLS.join(', '),
  permissionMode: 'dontAsk',
  maxTurns: 50,
  collaboratorIds: [],
  instructionsGuidance: '',
};

export function toFormValues(agent: AgentDto): AgentFormValues {
  return { ...agent, allowedTools: agent.allowedTools.join(', '), instructionsGuidance: '' };
}

export function parseTools(tools: string): string[] {
  return tools
    .split(/[,\n]/)
    .map((tool) => tool.trim())
    .filter(Boolean);
}

export function toInstructionsBrief(values: AgentFormValues) {
  const { name, role, description, allowedTools, collaboratorIds, instructionsGuidance } = values;
  return {
    name,
    role,
    description,
    allowedTools: parseTools(allowedTools),
    collaboratorIds,
    guidance: instructionsGuidance,
  };
}

export const canDraftInstructions = (values: AgentFormValues) =>
  values.name.trim() !== '' && values.role.trim() !== '';

export function toAgentInput({
  collaboratorIds: _ids,
  instructionsGuidance: _guidance,
  allowedTools,
  ...values
}: AgentFormValues): AgentInput {
  return { ...values, allowedTools: parseTools(allowedTools) };
}
