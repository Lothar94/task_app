import type { AgentSearchHit, ProjectSearchHit, SearchResultsDto, TaskSearchHit } from '@fleet/shared';

export type SearchOption =
  | { kind: 'project'; key: string; href: string; hit: ProjectSearchHit }
  | { kind: 'task'; key: string; href: string; hit: TaskSearchHit }
  | { kind: 'agent'; key: string; href: string; hit: AgentSearchHit };

export type SearchKind = SearchOption['kind'];

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  options: SearchOption[];
}

const projectOption = (hit: ProjectSearchHit): SearchOption => ({
  kind: 'project',
  key: `project-${hit.id}`,
  href: `/projects/${hit.id}`,
  hit,
});

const taskOption = (hit: TaskSearchHit): SearchOption => ({
  kind: 'task',
  key: `task-${hit.id}`,
  href: `/projects/${hit.projectId}/tasks/${hit.id}`,
  hit,
});

const agentOption = (hit: AgentSearchHit): SearchOption => ({
  kind: 'agent',
  key: `agent-${hit.id}`,
  href: `/agents/${hit.id}`,
  hit,
});

/** Non-empty result groups in display order: projects, tasks, agents. */
export function buildSearchGroups(results: SearchResultsDto | undefined): SearchGroup[] {
  if (!results) return [];
  const groups: SearchGroup[] = [
    { kind: 'project', label: 'Proyectos', options: results.projects.map(projectOption) },
    { kind: 'task', label: 'Tareas', options: results.tasks.map(taskOption) },
    { kind: 'agent', label: 'Agentes', options: results.agents.map(agentOption) },
  ];
  return groups.filter((group) => group.options.length > 0);
}

export type NavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

const NAVIGATION_KEYS: readonly string[] = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

export const isNavigationKey = (key: string): key is NavigationKey => NAVIGATION_KEYS.includes(key);

/** Next active option: arrows wrap around, Home/End jump to the ends. -1 when there are no options. */
export function moveActiveIndex(current: number, count: number, key: NavigationKey): number {
  if (count === 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowDown' ? 1 : -1;
  return (current + step + count) % count;
}

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** ⌘K on macOS, Ctrl+K elsewhere (both accepted everywhere). */
export const isSearchShortcut = (event: ShortcutEvent) =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';

const isApplePlatform = (platform: string) => /mac|iphone|ipad/i.test(platform);

export const shortcutLabel = (platform: string) => (isApplePlatform(platform) ? '⌘K' : 'Ctrl K');

export function currentPlatform(): string {
  const { userAgentData } = navigator as Navigator & { userAgentData?: { platform: string } };
  return userAgentData?.platform ?? navigator.platform ?? '';
}

/** "3 resultados", "1 resultado", "Sin resultados". */
export function resultCountLabel(count: number): string {
  if (count === 0) return 'Sin resultados';
  return count === 1 ? '1 resultado' : `${count} resultados`;
}
