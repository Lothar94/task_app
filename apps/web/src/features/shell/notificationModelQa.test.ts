import type { FleetEvent } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { applyFleetEvent, countUnread, type FleetNotification, markAllRead, markRead, MAX_NOTIFICATIONS } from './notificationModel';
import { created, updated } from './notificationTestData';

const NOW = '2026-10-21T09:00:00.000Z';
const apply = (events: FleetEvent[], start: FleetNotification[] = []) =>
  events.reduce((items, event) => applyFleetEvent(items, event, NOW), start);
const ids = (items: FleetNotification[]) => items.map((item) => item.id);

describe('notification derivation QA', () => {
  it('does not notify a completed subtask but does notify a failed one', () => {
    expect(apply([updated({ status: 'completed', parentTaskId: 'root' })])).toEqual([]);
    expect(ids(apply([updated({ id: 'sub', status: 'failed', parentTaskId: 'root' })]))).toEqual(['sub:failed']);
  });

  it('removes a proposal when the task starts and does not notify the start', () => {
    const items = apply([
      created({ status: 'draft', proposedByAgentId: 'a2' }),
      updated({ status: 'running', proposedByAgentId: 'a2' }),
    ]);
    expect(items).toEqual([]);
  });

  it('removes a proposal even when it was already read', () => {
    const read = markAllRead(apply([created({ status: 'draft', proposedByAgentId: 'a2' })]));
    expect(countUnread(read)).toBe(0);
    expect(apply([updated({ status: 'cancelled', proposedByAgentId: 'a2' })], read)).toEqual([]);
  });

  it('only removes the proposal of the task that changed', () => {
    const items = apply([
      created({ id: 't1', status: 'draft', proposedByAgentId: 'a2' }),
      created({ id: 't2', status: 'draft', proposedByAgentId: 'a2' }),
      updated({ id: 't1', status: 'queued', proposedByAgentId: 'a2' }),
    ]);
    expect(ids(items)).toEqual(['t2:proposal']);
  });

  it('ignores duplicated proposal events and keeps the first one read state', () => {
    const first = apply([created({ status: 'draft', proposedByAgentId: 'a2' })]);
    const read = markRead(first, 't1:proposal');
    const again = apply([created({ status: 'draft', proposedByAgentId: 'a2' })], read);
    expect(again).toBe(read);
    expect(countUnread(again)).toBe(0);
  });

  it('keeps a read failed notification read when the same failure is replayed', () => {
    const read = markAllRead(apply([updated({ status: 'failed' })]));
    expect(apply([updated({ status: 'failed' })], read)).toBe(read);
  });

  it('notifies both failure and completion of different tasks, and a proposal that finishes as a root completion', () => {
    const items = apply([
      created({ id: 'p', status: 'draft', proposedByAgentId: 'a2' }),
      updated({ id: 'p', status: 'completed', proposedByAgentId: 'a2' }),
      updated({ id: 'f', status: 'failed' }),
    ]);
    expect(ids(items)).toEqual(['f:failed', 'p:completed']);
  });

  it('does not notify created events that are already finished or failed', () => {
    expect(apply([created({ status: 'completed' }), created({ status: 'failed' })])).toEqual([]);
  });

  it('does not notify a manual draft updated or a queued/waiting/cancelled task', () => {
    const statuses = ['pending', 'queued', 'running', 'waiting_subtasks', 'cancelled'] as const;
    expect(apply(statuses.map((status) => updated({ status })))).toEqual([]);
  });

  it('caps at the maximum keeping the newest even when older ones are unread', () => {
    const events = Array.from({ length: MAX_NOTIFICATIONS + 1 }, (_, i) => updated({ id: `t${i}`, status: 'failed' }));
    const items = apply(events);
    expect(items).toHaveLength(MAX_NOTIFICATIONS);
    expect(ids(items)).not.toContain('t0:failed');
  });

  it('marking an unknown id read is a no-op that keeps the unread count', () => {
    const items = apply([updated({ status: 'failed' })]);
    expect(countUnread(markRead(items, 'ghost:failed'))).toBe(1);
  });

  it('does not mutate its input', () => {
    const items = apply([updated({ status: 'failed' })]);
    const snapshot = JSON.stringify(items);
    apply([updated({ id: 'x', status: 'completed' })], items);
    markAllRead(items);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
