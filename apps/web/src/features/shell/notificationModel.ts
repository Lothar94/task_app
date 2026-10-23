import type { FleetEvent, TaskDto } from '@fleet/shared';

export const NOTIFICATION_KINDS = ['failed', 'proposal', 'completed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface FleetNotification {
  /** `${taskId}:${kind}`: a task raises each kind of notification once. */
  id: string;
  kind: NotificationKind;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
  projectId: string;
  createdAt: string;
  read: boolean;
}

export const MAX_NOTIFICATIONS = 50;

export const notificationId = (taskId: string, kind: NotificationKind) => `${taskId}:${kind}`;

type TaskEvent = Extract<FleetEvent, { task: TaskDto }>;

/** What a task event is worth notifying: failures, agent proposals awaiting approval and finished root tasks. */
export function notificationKindOf(event: TaskEvent): NotificationKind | null {
  const { task } = event;
  if (task.status === 'draft' && task.proposedByAgentId !== null) return 'proposal';
  if (event.type !== 'task.updated') return null;
  if (task.status === 'failed') return 'failed';
  if (task.status === 'completed' && task.parentTaskId === null) return 'completed';
  return null;
}

/** A proposal that left `draft` was approved or discarded: its notification no longer applies. */
function dropResolvedProposal(items: FleetNotification[], task: TaskDto): FleetNotification[] {
  if (task.status === 'draft') return items;
  const id = notificationId(task.id, 'proposal');
  return items.some((item) => item.id === id) ? items.filter((item) => item.id !== id) : items;
}

const toNotification = (task: TaskDto, kind: NotificationKind, now: string): FleetNotification => ({
  id: notificationId(task.id, kind),
  kind,
  taskId: task.id,
  taskNumber: task.number,
  taskTitle: task.title,
  projectId: task.projectId,
  createdAt: now,
  read: false,
});

/** Notifications after an event, newest first and capped. Unchanged input is returned as is. */
export function applyFleetEvent(items: FleetNotification[], event: FleetEvent, now: string): FleetNotification[] {
  if (event.type === 'task.message_appended' || event.type === 'agent.activity') return items;
  const current = dropResolvedProposal(items, event.task);
  const kind = notificationKindOf(event);
  if (kind === null || current.some((item) => item.id === notificationId(event.task.id, kind))) return current;
  return [toNotification(event.task, kind, now), ...current].slice(0, MAX_NOTIFICATIONS);
}

export const markRead = (items: FleetNotification[], id: string) =>
  items.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item));

export const markAllRead = (items: FleetNotification[]) =>
  items.some((item) => !item.read) ? items.map((item) => (item.read ? item : { ...item, read: true })) : items;

export const countUnread = (items: FleetNotification[]) => items.filter((item) => !item.read).length;
