import { TASK_LIMITS, type TaskStartMode } from '@fleet/shared';

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
