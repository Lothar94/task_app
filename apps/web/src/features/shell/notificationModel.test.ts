import type { FleetEvent } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  applyFleetEvent,
  countUnread,
  type FleetNotification,
  markAllRead,
  markRead,
  MAX_NOTIFICATIONS,
} from './notificationModel';
import { created, updated } from './notificationTestData';

const NOW = '2026-10-21T09:00:00.000Z';
const apply = (events: FleetEvent[], start: FleetNotification[] = []) =>
  events.reduce((items, event) => applyFleetEvent(items, event, NOW), start);

describe('applyFleetEvent', () => {
  it('notifies failures with the task data, unread', () => {
    expect(apply([updated({ status: 'failed' })])).toEqual([
      {
        id: 't1:failed',
        kind: 'failed',
        taskId: 't1',
        taskNumber: 7,
        taskTitle: 'Migrar login',
        projectId: 'p1',
        createdAt: NOW,
        read: false,
      },
    ]);
  });

  it('notifies agent proposals in draft, created or updated, but not manual drafts', () => {
    expect(apply([created({ status: 'draft', proposedByAgentId: 'a2' })]).map((item) => item.kind)).toEqual([
      'proposal',
    ]);
    expect(apply([updated({ id: 't2', status: 'draft', proposedByAgentId: 'a2' })])[0]?.id).toBe('t2:proposal');
    expect(apply([created({ status: 'draft' })])).toEqual([]);
  });

  it('notifies completed root tasks only', () => {
    expect(apply([updated({ status: 'completed' })])[0]?.kind).toBe('completed');
    expect(apply([updated({ status: 'completed', parentTaskId: 'root' })])).toEqual([]);
  });

  it('ignores other statuses, created non-proposals and messages', () => {
    const message = { type: 'task.message_appended', projectId: 'p1', message: {} } as FleetEvent;
    const before: FleetNotification[] = [];
    expect(apply([updated({ status: 'running' }), created({ status: 'failed' }), message], before)).toBe(before);
  });

  it('dedupes by task and kind, newest first', () => {
    const items = apply([
      updated({ status: 'failed' }),
      updated({ status: 'failed', title: 'Otra vez' }),
      updated({ id: 't2', status: 'completed' }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['t2:completed', 't1:failed']);
    expect(items[1]?.taskTitle).toBe('Migrar login');
  });

  it('removes the proposal once it leaves draft', () => {
    const proposed = apply([created({ status: 'draft', proposedByAgentId: 'a2' })]);
    expect(apply([updated({ status: 'draft', proposedByAgentId: 'a2', title: 'Editada' })], proposed)).toBe(proposed);
    expect(apply([updated({ status: 'queued', proposedByAgentId: 'a2' })], proposed)).toEqual([]);
  });

  it(`keeps the ${MAX_NOTIFICATIONS} newest`, () => {
    const events = Array.from({ length: MAX_NOTIFICATIONS + 5 }, (_, index) =>
      updated({ id: `t${index}`, status: 'failed' }),
    );
    const items = apply(events);
    expect(items).toHaveLength(MAX_NOTIFICATIONS);
    expect(items[0]?.taskId).toBe(`t${MAX_NOTIFICATIONS + 4}`);
  });
});

describe('read state', () => {
  const items = apply([updated({ status: 'failed' }), updated({ id: 't2', status: 'completed' })]);

  it('marks one or all as read and counts the unread', () => {
    expect(countUnread(items)).toBe(2);
    expect(countUnread(markRead(items, 't1:failed'))).toBe(1);
    const allRead = markAllRead(items);
    expect(countUnread(allRead)).toBe(0);
    expect(markAllRead(allRead)).toBe(allRead);
  });
});
