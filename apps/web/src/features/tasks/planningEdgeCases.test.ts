import { TASK_LIMITS, type TaskNodeDto, type TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { moveItem } from './queueModel';
import { isTaskActive, isTaskPlanned } from './TaskStatusBadge';
import { addTag, formatTags, milestoneOrNull, parseTags, validateLabels } from './taskFormModel';
import { buildTaskList, existingMilestones, existingTags, queuedTasks } from './taskListModel';

const task = (number: number, extra: Partial<TaskNodeDto> = {}): TaskNodeDto =>
  ({
    id: `t${number}`,
    number,
    projectId: 'p',
    parentTaskId: null,
    agentId: 'a',
    title: `Tarea ${number}`,
    description: '',
    status: 'completed',
    resultSummary: null,
    milestone: null,
    tags: [],
    queuePosition: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    children: [],
    ...extra,
  }) as TaskNodeDto;

const view = (overrides = {}) => ({ groupBy: 'none' as const, sortBy: 'number' as const, tag: '', ...overrides });
const labelled = (groups: ReturnType<typeof buildTaskList>) =>
  groups.map((g) => [g.label, g.nodes.map((n) => n.number)]);

describe('status helpers', () => {
  const all: TaskStatus[] = ['draft', 'queued', 'pending', 'running', 'waiting_subtasks', 'completed', 'failed', 'cancelled'];

  it('treats only pending/running/waiting_subtasks as active', () => {
    expect(all.filter(isTaskActive)).toEqual(['pending', 'running', 'waiting_subtasks']);
  });

  it('treats only draft/queued as planned, never both planned and active', () => {
    expect(all.filter(isTaskPlanned)).toEqual(['draft', 'queued']);
    expect(all.filter((s) => isTaskActive(s) && isTaskPlanned(s))).toEqual([]);
  });
});

describe('queue model (QA)', () => {
  it('sends the full new order when moving the first/last/middle element', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(moveItem(ids, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveItem(ids, 3, -1)).toEqual(['a', 'b', 'd', 'c']);
    expect(moveItem(ids, 2, -1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('handles single-item and empty queues', () => {
    expect(moveItem(['a'], 0, -1)).toEqual(['a']);
    expect(moveItem(['a'], 0, 1)).toEqual(['a']);
    expect(moveItem([], 0, 1)).toEqual([]);
  });

  it('orders queued tasks by position, ignoring non-queued ones and putting missing positions last', () => {
    const roots = [
      task(1, { status: 'queued', queuePosition: 3 }),
      task(2, { status: 'draft' }),
      task(3, { status: 'queued', queuePosition: 1 }),
      task(4, { status: 'running' }),
      task(5, { status: 'queued', queuePosition: null }),
    ];
    expect(queuedTasks(roots).map((t) => t.number)).toEqual([3, 1, 5]);
  });
});

describe('form model (QA)', () => {
  it('accepts values exactly at the contract limits and rejects one over', () => {
    const tags = Array.from({ length: TASK_LIMITS.maxTags }, (_, i) => `t${i}`).join(',');
    expect(validateLabels('m'.repeat(TASK_LIMITS.milestoneLength), tags)).toBeNull();
    expect(validateLabels('', 'x'.repeat(TASK_LIMITS.tagLength))).toBeNull();
    expect(validateLabels(` ${'m'.repeat(TASK_LIMITS.milestoneLength)} `, '')).toBeNull();
  });

  it('does not count duplicate or blank tags against the limit (mirrors the server)', () => {
    const tags = `${Array.from({ length: TASK_LIMITS.maxTags }, (_, i) => `t${i}`).join(',')}, T0, ,`;
    expect(validateLabels('', tags)).toBeNull();
  });

  it('keeps the first spelling of a repeated tag and round-trips through formatTags', () => {
    expect(parseTags('Bug, bug, BUG')).toEqual(['Bug']);
    expect(parseTags(formatTags(['a', 'b']))).toEqual(['a', 'b']);
    expect(parseTags(' , ,')).toEqual([]);
  });

  it('adds a suggestion to empty text and normalises the separators', () => {
    expect(addTag('', 'api')).toBe('api');
    expect(addTag('ui,,', 'api')).toBe('ui, api');
  });

  it('maps blank milestones to null so the server clears them', () => {
    expect(milestoneOrNull('')).toBeNull();
    expect(milestoneOrNull('\t')).toBeNull();
  });
});

describe('task list model (QA)', () => {
  it('filters by tag and then groups, so groups only contain matching tasks', () => {
    const roots = [task(1, { tags: ['ui', 'bug'] }), task(2, { tags: ['ui'] }), task(3, { tags: ['api'] })];
    expect(labelled(buildTaskList(roots, view({ tag: 'UI', groupBy: 'tag' })))).toEqual([
      ['bug', [1]],
      ['ui', [1, 2].reverse()],
    ]);
  });

  it('sorts inside each milestone group by the selected criterion', () => {
    const roots = [
      task(1, { milestone: 'v1', status: 'completed' }),
      task(2, { milestone: 'v1', status: 'running' }),
      task(3, { milestone: 'v1', status: 'queued', queuePosition: 1 }),
    ];
    expect(labelled(buildTaskList(roots, view({ groupBy: 'milestone', sortBy: 'status' })))).toEqual([
      ['v1', [2, 3, 1]],
    ]);
  });

  it('shows only "Sin milestone" when no task has one', () => {
    expect(labelled(buildTaskList([task(1), task(2)], view({ groupBy: 'milestone' })))).toEqual([
      ['Sin milestone', [2, 1]],
    ]);
  });

  // Regression QA-W1: groups, suggestions and sorting must treat "V1" and "v1" as the same milestone.
  it('groups milestones that differ only in case into one group (QA-W1)', () => {
    const roots = [task(1, { milestone: 'v1' }), task(2, { milestone: 'V1' })];
    expect(existingMilestones(roots)).toHaveLength(1);
    expect(buildTaskList(roots, view({ groupBy: 'milestone' }))).toHaveLength(1);
  });

  // Regression QA-W2: filtering and grouping share one tag equivalence (case-insensitive, accent-sensitive).
  it('uses the same tag equivalence for filtering and grouping (QA-W2)', () => {
    const roots = [task(1, { tags: ['café'] }), task(2, { tags: ['cafe'] })];
    const filtered = buildTaskList(roots, view({ tag: 'cafe' }))[0]?.nodes ?? [];
    const grouped = buildTaskList(roots, view({ groupBy: 'tag' }));
    expect(grouped.length === 1).toBe(filtered.length === 2);
  });

  // Regression QA-W3: group labels and suggestions show the same spelling of a tag.
  it('uses the same tag spelling in group labels and suggestions (QA-W3)', () => {
    const roots = [task(1, { tags: ['Bug'] }), task(2, { tags: ['bug'] })];
    const label = buildTaskList(roots, view({ groupBy: 'tag' }))[0]?.label;
    expect(label).toBe(existingTags(roots)[0]);
  });
});
