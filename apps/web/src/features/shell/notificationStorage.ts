import { type FleetNotification, MAX_NOTIFICATIONS, NOTIFICATION_KINDS } from './notificationModel';

const storageKey = (organizationId: string) => `fleet.notifications.${organizationId}`;

const FIELD_TYPES: Record<keyof FleetNotification, 'string' | 'number' | 'boolean'> = {
  id: 'string',
  kind: 'string',
  taskId: 'string',
  taskNumber: 'number',
  taskTitle: 'string',
  projectId: 'string',
  createdAt: 'string',
  read: 'boolean',
};

function isNotification(value: unknown): value is FleetNotification {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const hasFields = Object.entries(FIELD_TYPES).every(([field, type]) => typeof record[field] === type);
  return hasFields && (NOTIFICATION_KINDS as readonly unknown[]).includes(record.kind);
}

/** Notifications remembered in this browser for an organization; corrupt or missing storage reads as none. */
export function loadNotifications(organizationId: string): FleetNotification[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(organizationId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isNotification).slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(organizationId: string, items: FleetNotification[]): void {
  try {
    localStorage.setItem(storageKey(organizationId), JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Storage unavailable or full: notifications only last for this session.
  }
}
