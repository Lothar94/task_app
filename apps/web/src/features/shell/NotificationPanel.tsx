import { CheckCheck } from 'lucide-react';
import { type Ref, useState } from 'react';
import { FOCUS_RING } from '../../components/ui';
import { useProjects } from '../projects/projectQueries';
import type { FleetNotification } from './notificationModel';
import { NotificationItem } from './NotificationItem';

interface NotificationPanelProps {
  id: string;
  panelRef: Ref<HTMLDivElement>;
  items: FleetNotification[];
  unreadCount: number;
  onOpen: (notification: FleetNotification) => void;
  onMarkAllRead: () => void;
}

export function NotificationPanel({ id, panelRef, items, unreadCount, onOpen, onMarkAllRead }: NotificationPanelProps) {
  const projects = useProjects();
  const [now] = useState(() => Date.now());
  const projectName = (projectId: string) => projects.data?.find((project) => project.id === projectId)?.name;
  const headingId = `${id}-heading`;

  return (
    <div
      id={id}
      ref={panelRef}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="absolute top-full right-2 z-50 mt-1 w-[22rem] max-w-[calc(100vw-1rem)] rounded-sm border border-line bg-surface-raised shadow-float outline-none sm:right-0"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 id={headingId} className="text-sm font-semibold">
          Notificaciones
        </h2>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-accent hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-fg-subtle disabled:hover:bg-transparent ${FOCUS_RING}`}
        >
          <CheckCheck aria-hidden className="size-3.5" />
          Marcar todas como leídas
        </button>
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-fg-subtle">Sin notificaciones.</p>
      ) : (
        <ul className="max-h-[min(28rem,70dvh)] divide-y divide-line overflow-y-auto">
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              projectName={projectName(notification.projectId)}
              now={now}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
