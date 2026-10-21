import { Bell } from 'lucide-react';
import { type KeyboardEvent, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { IconButton } from '../../components/ui';
import { useCurrentOrganization } from '../organizations/OrganizationContext';
import type { FleetNotification } from './notificationModel';
import { NotificationPanel } from './NotificationPanel';
import { useNotifications } from './useNotifications';

const bellLabel = (unread: number) => (unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones');

/** Closes `isOpen` popovers on a pointer press outside `container`. */
function useOutsidePress(container: RefObject<HTMLElement | null>, isOpen: boolean, onOutside: () => void) {
  const handlerRef = useRef(onOutside);
  useEffect(() => {
    handlerRef.current = onOutside;
  });
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) handlerRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [container, isOpen]);
}

/** Bell of the masthead with the unread count and a panel listing the organization's notifications. */
export function NotificationCenter() {
  const { id: organizationId } = useCurrentOrganization();
  const notifications = useNotifications(organizationId);
  const navigate = useNavigate();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);
  const { unreadCount } = notifications;

  useOutsidePress(rootRef, isOpen, () => setOpen(false));
  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false);
    buttonRef.current?.focus();
  };

  const openNotification = (notification: FleetNotification) => {
    notifications.markRead(notification.id);
    setOpen(false);
    navigate(`/projects/${notification.projectId}/tasks/${notification.taskId}`);
  };

  return (
    <div ref={rootRef} className="sm:relative" onKeyDown={onKeyDown}>
      <IconButton
        ref={buttonRef}
        label={bellLabel(unreadCount)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setOpen((open) => !open)}
        className="relative size-8"
      >
        <Bell aria-hidden className="size-[18px]" />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-danger px-1 font-mono text-[0.625rem] leading-4 font-semibold text-canvas"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </IconButton>
      {isOpen && (
        <NotificationPanel
          id={panelId}
          panelRef={panelRef}
          items={notifications.items}
          unreadCount={unreadCount}
          onOpen={openNotification}
          onMarkAllRead={notifications.markAllRead}
        />
      )}
    </div>
  );
}
