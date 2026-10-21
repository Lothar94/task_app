import { CircleCheck, CircleX, Lightbulb } from 'lucide-react';
import { FOCUS_RING } from '../../components/ui';
import { formatDistanceLabel } from '../dashboard/timeAgo';
import type { FleetNotification, NotificationKind } from './notificationModel';

const KIND_PRESENTATION: Record<NotificationKind, { label: string; icon: typeof Lightbulb; tone: string }> = {
  failed: { label: 'Tarea fallida', icon: CircleX, tone: 'text-danger' },
  proposal: { label: 'Propuesta pendiente de aprobación', icon: Lightbulb, tone: 'text-warning' },
  completed: { label: 'Tarea completada', icon: CircleCheck, tone: 'text-success' },
};

interface NotificationItemProps {
  notification: FleetNotification;
  projectName: string | undefined;
  now: number;
  onOpen: (notification: FleetNotification) => void;
}

export function NotificationItem({ notification, projectName, now, onOpen }: NotificationItemProps) {
  const { label, icon: Icon, tone } = KIND_PRESENTATION[notification.kind];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:-outline-offset-2 ${FOCUS_RING}`}
      >
        <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className={`label-mono block ${tone}`}>{label}</span>
          <span className={`block truncate text-sm ${notification.read ? 'text-fg-muted' : 'font-medium text-fg'}`}>
            Tarea {notification.taskNumber} · {notification.taskTitle}
          </span>
          <span className="block truncate text-xs text-fg-subtle">
            {projectName ? `${projectName} · ` : ''}
            <time dateTime={notification.createdAt}>{formatDistanceLabel(notification.createdAt, now)}</time>
          </span>
        </span>
        {!notification.read && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent">
            <span className="sr-only">No leída</span>
          </span>
        )}
      </button>
    </li>
  );
}
