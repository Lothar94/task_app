import type { TaskNodeDto, TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { buildTaskList, existingMilestones, existingTags, queuedTasks } from './taskListModel';

const task = (number: number, extra: Partial<TaskNodeDto> = {}): TaskNodeDto => ({
  id: `t${number}`,
  number,
  projectId: 'p',
  parentTaskId: null,
  agentId: 'a',
  title: `Tarea ${number}`,
  description: '',
  status: 'completed' as TaskStatus,
  resultSummary: null,
  milestone: null,
  tags: [],
  queuePosition: null,
  createdAt: `2026-01-0${number}T00:00:00Z`,
  startedAt: null,
  finishedAt: null,
  metrics: {
    runs: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  },
  children: [],
  ...extra,
});

const roots = [
  task(1, { status: 'completed', milestone: 'v2', tags: ['ui', 'Bug'], createdAt: '2026-03-01T00:00:00Z' }),
  task(2, { status: 'running', milestone: 'v1', tags: ['bug'] }),
  task(3, { status: 'draft' }),
  task(4, { status: 'queued', milestone: 'v1', queuePosition: 2 }),
  task(5, { status: 'queued', queuePosition: 1, tags: ['ui'] }),
];

const numbers = (nodes: TaskNodeDto[]) => nodes.map((node) => node.number);
const view = (overrides = {}) => ({
  groupBy: 'none' as const,
  sortBy: 'number' as const,
  tag: '',
  ...overrides,
});
const flat = (overrides = {}) => numbers(buildTaskList(roots, view(overrides))[0]?.nodes ?? []);

describe('task list model', () => {
  describe('sorting', () => {
    it('orders by number, newest first', () => expect(flat()).toEqual([5, 4, 3, 2, 1]));
    it('orders by creation date, newest first', () =>
      expect(flat({ sortBy: 'created' })).toEqual([1, 5, 4, 3, 2]));
    it('orders by status, active work first, ties by number', () =>
      expect(flat({ sortBy: 'status' })).toEqual([2, 5, 4, 3, 1]));
    it('orders by milestone with tasks without milestone last', () =>
      expect(flat({ sortBy: 'milestone' })).toEqual([4, 2, 1, 5, 3]));
    it('does not mutate the input', () => {
      buildTaskList(roots, view({ sortBy: 'status' }));
      expect(numbers(roots)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('grouping', () => {
    it('returns a single unlabelled group when not grouping', () => {
      expect(buildTaskList(roots, view())).toMatchObject([{ label: null }]);
      expect(buildTaskList([], view())).toEqual([]);
    });

    it('groups by milestone with "Sin milestone" last', () => {
      const groups = buildTaskList(roots, view({ groupBy: 'milestone' }));
      expect(groups.map((g) => [g.label, numbers(g.nodes)])).toEqual([
        ['v1', [4, 2]],
        ['v2', [1]],
        ['Sin milestone', [5, 3]],
      ]);
    });

    it('lists a task with several tags in each tag group, case-insensitively, "Sin tag" last', () => {
      const groups = buildTaskList(roots, view({ groupBy: 'tag' }));
      expect(groups.map((g) => [g.label, numbers(g.nodes)])).toEqual([
        ['bug', [2, 1]],
        ['ui', [5, 1]],
        ['Sin tag', [4, 3]],
      ]);
    });

    it('groups by status in display order, skipping empty groups', () => {
      const groups = buildTaskList(roots, view({ groupBy: 'status' }));
      expect(groups.map((g) => [g.label, numbers(g.nodes)])).toEqual([
        ['Trabajando', [2]],
        ['En cola', [5, 4]],
        ['Borrador', [3]],
        ['Completada', [1]],
      ]);
    });

    it('keeps subtasks nested under their root', () => {
      const child = task(9, { parentTaskId: 't2' });
      const withChild = [task(2, { children: [child] })];
      expect(buildTaskList(withChild, view())[0]?.nodes[0]?.children).toEqual([child]);
    });
  });

  describe('filtering', () => {
    it('keeps only tasks with the tag, ignoring case', () => expect(flat({ tag: 'BUG' })).toEqual([2, 1]));
    it('yields no groups when nothing matches', () =>
      expect(buildTaskList(roots, view({ tag: 'nada' }))).toEqual([]));
  });

  describe('suggestions and queue', () => {
    it('lists distinct milestones and tags alphabetically', () => {
      expect(existingMilestones(roots)).toEqual(['v1', 'v2']);
      expect(existingTags(roots)).toEqual(['Bug', 'ui']);
    });

    it('orders queued tasks by queue position', () => expect(numbers(queuedTasks(roots))).toEqual([5, 4]));
  });
});
