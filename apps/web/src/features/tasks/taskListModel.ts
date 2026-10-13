import type { TaskNodeDto, TaskStatus } from '@fleet/shared';

export const GROUP_OPTIONS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'tag', label: 'Tag' },
  { value: 'status', label: 'Estado' },
] as const;
export type GroupBy = (typeof GROUP_OPTIONS)[number]['value'];

export const SORT_OPTIONS = [
  { value: 'number', label: 'Número' },
  { value: 'created', label: 'Creación' },
  { value: 'status', label: 'Estado' },
  { value: 'milestone', label: 'Milestone' },
] as const;
export type SortBy = (typeof SORT_OPTIONS)[number]['value'];

export const ALL_TAGS = '';

export interface TaskListView {
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Only root tasks carrying this tag (case-insensitive); empty shows every task. */
  tag: string;
}

export interface TaskGroup {
  key: string;
  /** Null when the list is not grouped. */
  label: string | null;
  nodes: TaskNodeDto[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Borrador',
  queued: 'En cola',
  pending: 'Pendiente',
  running: 'Trabajando',
  waiting_subtasks: 'Esperando subtareas',
  completed: 'Completada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

/** Display order of statuses: work in progress first, finished work last. */
const STATUS_ORDER: TaskStatus[] = [
  'running',
  'waiting_subtasks',
  'pending',
  'queued',
  'draft',
  'failed',
  'completed',
  'cancelled',
];
const statusRank = (status: TaskStatus) => STATUS_ORDER.indexOf(status);

const NO_MILESTONE = 'Sin milestone';
const NO_TAG = 'Sin tag';

const byNumberDesc = (a: TaskNodeDto, b: TaskNodeDto) => b.number - a.number;
const compareText = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });
/** Alphabetical, with the missing value always last. */
const compareOptionalText = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : compareText(a, b);

const COMPARATORS: Record<SortBy, (a: TaskNodeDto, b: TaskNodeDto) => number> = {
  number: byNumberDesc,
  created: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  status: (a, b) => statusRank(a.status) - statusRank(b.status),
  milestone: (a, b) => compareOptionalText(a.milestone, b.milestone),
};

export function sortTasks(nodes: TaskNodeDto[], sortBy: SortBy): TaskNodeDto[] {
  const compare = COMPARATORS[sortBy];
  return [...nodes].sort((a, b) => compare(a, b) || byNumberDesc(a, b));
}

const sameText = (a: string, b: string) => compareText(a, b) === 0;

export const hasTag = (node: TaskNodeDto, tag: string) => node.tags.some((value) => sameText(value, tag));

/** Distinct values (case-insensitive, first spelling wins) sorted alphabetically. */
function distinct(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) if (!unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value);
  return [...unique.values()].sort(compareText);
}

export const existingMilestones = (roots: TaskNodeDto[]) =>
  distinct(roots.flatMap((node) => (node.milestone ? [node.milestone] : [])));

export const existingTags = (roots: TaskNodeDto[]) => distinct(roots.flatMap((node) => node.tags));

/** Queued root tasks in the order the project will run them. */
export const queuedTasks = (roots: TaskNodeDto[]) =>
  roots
    .filter((node) => node.status === 'queued')
    .sort((a, b) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity));

/** Buckets tasks by key, preserving the (already sorted) order inside each bucket. */
function bucket(nodes: TaskNodeDto[], keysOf: (node: TaskNodeDto) => string[]): Map<string, TaskNodeDto[]> {
  const buckets = new Map<string, TaskNodeDto[]>();
  for (const node of nodes)
    for (const key of keysOf(node)) buckets.set(key, [...(buckets.get(key) ?? []), node]);
  return buckets;
}

function labelledGroups(
  buckets: Map<string, TaskNodeDto[]>,
  emptyLabel: string,
  labelOf: (key: string) => string,
): TaskGroup[] {
  const groups = [...buckets]
    .filter(([key]) => key !== '')
    .sort(([a], [b]) => compareText(a, b))
    .map(([key, nodes]) => ({ key, label: labelOf(key), nodes }));
  const empty = buckets.get('');
  return empty ? [...groups, { key: '', label: emptyLabel, nodes: empty }] : groups;
}

function groupTasks(nodes: TaskNodeDto[], groupBy: GroupBy): TaskGroup[] {
  switch (groupBy) {
    case 'none':
      return nodes.length > 0 ? [{ key: 'all', label: null, nodes }] : [];
    case 'milestone':
      return labelledGroups(
        bucket(nodes, (node) => [node.milestone ?? '']),
        NO_MILESTONE,
        (key) => key,
      );
    case 'tag': {
      const spelling = new Map(
        distinct(nodes.flatMap((node) => node.tags)).map((tag) => [tag.toLowerCase(), tag]),
      );
      return labelledGroups(
        bucket(nodes, (node) => (node.tags.length > 0 ? node.tags.map((tag) => tag.toLowerCase()) : [''])),
        NO_TAG,
        (key) => spelling.get(key) ?? key,
      );
    }
    case 'status':
      return STATUS_ORDER.flatMap((status) => {
        const inStatus = nodes.filter((node) => node.status === status);
        return inStatus.length > 0 ? [{ key: status, label: STATUS_LABELS[status], nodes: inStatus }] : [];
      });
  }
}

/** Filters, sorts and groups the root tasks; subtasks stay nested under their root. */
export function buildTaskList(roots: TaskNodeDto[], view: TaskListView): TaskGroup[] {
  const visible = view.tag === ALL_TAGS ? roots : roots.filter((node) => hasTag(node, view.tag));
  return groupTasks(sortTasks(visible, view.sortBy), view.groupBy);
}
