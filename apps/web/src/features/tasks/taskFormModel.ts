import {
  type AgentDto,
  type AgentEffort,
  type AgentModel,
  type RunModelChoice,
  TASK_LIMITS,
  type TaskStartMode,
} from '@fleet/shared';
import { EFFORT_LABELS } from '../agents/agentLabels';

/** Splits a comma-separated text into trimmed, case-insensitively unique tags. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (tag === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const formatTags = (tags: string[]) => tags.join(', ');

/** Adds a suggested tag to the comma-separated text unless it is already there. */
export function addTag(text: string, tag: string): string {
  const tags = parseTags(text);
  return tags.some((value) => value.toLowerCase() === tag.toLowerCase()) ? text : formatTags([...tags, tag]);
}

/** Human-readable problems with the milestone/tags text, empty when valid. */
export function validateLabels(milestone: string, tagsText: string): string | null {
  const tags = parseTags(tagsText);
  if (milestone.trim().length > TASK_LIMITS.milestoneLength)
    return `El milestone admite hasta ${TASK_LIMITS.milestoneLength} caracteres.`;
  if (tags.length > TASK_LIMITS.maxTags) return `Máximo ${TASK_LIMITS.maxTags} tags.`;
  if (tags.some((tag) => tag.length > TASK_LIMITS.tagLength))
    return `Cada tag admite hasta ${TASK_LIMITS.tagLength} caracteres.`;
  return null;
}

/** Empty milestone text means "no milestone". */
export const milestoneOrNull = (text: string) => text.trim() || null;

const START_MODES: readonly TaskStartMode[] = ['now', 'queue', 'draft'];

/**
 * Start mode of the button that submitted the form. Without a known submitter (e.g. Enter in the
 * title field) it falls back to the safe `draft`, never to launching an agent.
 */
export const startModeOf = (submitterValue: string | undefined): TaskStartMode =>
  START_MODES.find((mode) => mode === submitterValue) ?? 'draft';

/** Model/effort the invoker picks for one task; empty strings mean "use the agent's default". */
export interface ModelChoiceValues {
  model: AgentModel | '';
  effort: AgentEffort | '';
}

export const EMPTY_MODEL_CHOICE: ModelChoiceValues = { model: '', effort: '' };

/** Only auto agents let the invoker choose; fixed agents never show nor send the selects. */
export const allowsModelChoice = (agent: Pick<AgentDto, 'modelSelection'> | undefined) =>
  agent?.modelSelection === 'auto';

/** Payload fields for the assignment: omitted unless the agent is auto, null when left on default. */
export function modelChoicePayload(agent: Pick<AgentDto, 'modelSelection'> | undefined, choice: ModelChoiceValues) {
  if (!allowsModelChoice(agent)) return {};
  return { model: choice.model || null, effort: choice.effort || null };
}

/** First option of the model select: keeps the agent's own model. */
export const defaultModelOption = (agent: Pick<AgentDto, 'model'>) =>
  `Por defecto del agente (${agent.model})`;

/** First option of the effort select: keeps the agent's own effort. */
export const defaultEffortOption = (agent: Pick<AgentDto, 'effort'>) =>
  `Por defecto del agente (${EFFORT_LABELS[agent.effort].toLowerCase()})`;

/** Task detail line about who chose the model; null for fixed agents. */
export function modelChoiceSummary(
  agent: Pick<AgentDto, 'model' | 'modelSelection'> | undefined,
  choice: RunModelChoice | undefined,
): string | null {
  if (agent?.modelSelection !== 'auto') return null;
  const { model, effort } = choice ?? { model: null, effort: null };
  const parts = [
    model && `Modelo elegido: ${model}`,
    effort && (model ? `esfuerzo ${effort}` : `Esfuerzo elegido: ${effort}`),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Automático: valores por defecto del agente';
}
