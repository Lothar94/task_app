import {
  type AgentDto,
  type AgentInput,
  type SkillDto,
  DEFAULT_AGENT_TOOLS,
  MAX_AGENT_SKILLS,
  MAX_SKILL_NAME_LENGTH,
  isValidSkillName,
  parseSkillName,
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

/** Returns a Spanish error message when `name` is not a valid skill name (`skill` or `plugin:skill`), or null when it is. */
export function validateSkillName(name: string): string | null {
  const { plugin, skill } = parseSkillName(name);
  if ([plugin, skill].some((part) => part !== null && part.length > MAX_SKILL_NAME_LENGTH))
    return `Cada parte del nombre no puede superar ${MAX_SKILL_NAME_LENGTH} caracteres`;
  if (!isValidSkillName(name)) {
    return 'Usa minúsculas, números y guiones simples (p. ej. code-review o plugin:skill)';
  }
  return null;
}

export const SKILL_LIMIT_MESSAGE = `Un agente admite como máximo ${MAX_AGENT_SKILLS} skills`;

export const canAddSkill = (skills: string[]) => skills.length < MAX_AGENT_SKILLS;

export type AddSkillResult = { skills: string[]; error: string | null };

/** Adds a skill keeping the list unique; duplicates and empty names are ignored silently. */
export function addSkill(skills: string[], rawName: string): AddSkillResult {
  const name = rawName.trim();
  if (name === '' || skills.includes(name)) return { skills, error: null };
  const error = validateSkillName(name);
  if (error) return { skills, error };
  if (!canAddSkill(skills)) return { skills, error: SKILL_LIMIT_MESSAGE };
  return { skills: [...skills, name], error: null };
}

export const removeSkill = (skills: string[], name: string) => skills.filter((skill) => skill !== name);

export interface SkillGroup {
  key: string;
  label: string;
  skills: SkillDto[];
}

/** Splits the catalog into "Tus skills" (first, when present) and one group per plugin, sorted by plugin name. */
export function groupSkills(catalog: SkillDto[]): SkillGroup[] {
  const own = catalog.filter((skill) => skill.plugin === null);
  const byPlugin = new Map<string, SkillDto[]>();
  for (const skill of catalog) {
    if (skill.plugin !== null) byPlugin.set(skill.plugin, [...(byPlugin.get(skill.plugin) ?? []), skill]);
  }
  const plugins = [...byPlugin.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plugin, skills]) => ({ key: `plugin:${plugin}`, label: `Plugin ${plugin}`, skills }));
  return own.length > 0 ? [{ key: 'own', label: 'Tus skills', skills: own }, ...plugins] : plugins;
}

/** Explains why a selected skill is missing from the catalog. */
export const missingSkillNote = (name: string) =>
  parseSkillName(name).plugin === null
    ? 'no instalada en ~/.claude/skills: debe existir en el proyecto'
    : 'plugin no instalado o desactivado';
