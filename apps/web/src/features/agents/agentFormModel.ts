import {
  type AgentDto,
  type AgentInput,
  DEFAULT_AGENT_TOOLS,
  MAX_AGENT_SKILLS,
  MAX_SKILL_NAME_LENGTH,
  SKILL_NAME_PATTERN,
} from '@fleet/shared';

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
  skills: [],
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
  const { name, role, description, allowedTools, skills, collaboratorIds, instructionsGuidance } = values;
  return {
    name,
    role,
    description,
    allowedTools: parseTools(allowedTools),
    skills,
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

/** Returns a Spanish error message when `name` is not a valid skill name, or null when it is. */
export function validateSkillName(name: string): string | null {
  if (name.length > MAX_SKILL_NAME_LENGTH)
    return `El nombre no puede superar ${MAX_SKILL_NAME_LENGTH} caracteres`;
  if (!SKILL_NAME_PATTERN.test(name)) {
    return 'Usa minúsculas, números y guiones simples, p. ej. code-review';
  }
  return null;
}

export type AddSkillResult = { skills: string[]; error: string | null };

/** Adds a skill keeping the list unique; duplicates and empty names are ignored silently. */
export function addSkill(skills: string[], rawName: string): AddSkillResult {
  const name = rawName.trim();
  if (name === '' || skills.includes(name)) return { skills, error: null };
  const error = validateSkillName(name);
  if (error) return { skills, error };
  if (skills.length >= MAX_AGENT_SKILLS) {
    return { skills, error: `Un agente admite como máximo ${MAX_AGENT_SKILLS} skills` };
  }
  return { skills: [...skills, name], error: null };
}

export const removeSkill = (skills: string[], name: string) => skills.filter((skill) => skill !== name);
