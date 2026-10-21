import type { TaskDto } from '@fleet/shared';
import { type ReactNode, useState } from 'react';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { ConversationPanel } from './ConversationPanel';
import { ResultPanel } from './ResultPanel';
import { TaskInspector } from './TaskInspector';
import { InspectorToggles } from './TaskPanelToggles';
import { isTaskActive, isTaskPlanned } from './TaskStatusBadge';
import { useInspectorDrawer } from './useInspectorDrawer';
import { useMastheadHeight } from './useMastheadHeight';
import { SCROLL_PANEL } from './taskPanelStyles';

const PANEL_CHOICES = ['shown', 'hidden'] as const;

/** Drawer below 1280px (only while open); a fixed-width rail above it unless the user hid it. */
function inspectorLayout(isDrawerOpen: boolean, isRailShown: boolean) {
  const drawer = isDrawerOpen ? 'fixed right-0 bottom-(--status-bar-height) z-40 flex w-[min(22rem,100vw)]' : 'hidden';
  const rail = isRailShown ? 'xl:static xl:z-auto xl:flex xl:w-[340px] xl:shrink-0' : 'xl:hidden';
  return `${drawer} ${rail}`;
}

/**
 * Viewport-high workspace of the task page (masthead and status bar excluded): central column and inspector,
 * each scrolling on its own. Below 1280px the inspector becomes a drawer.
 */
export function TaskWorkspace({
  task,
  agentName,
  agentNames,
  isReadOnly,
  header,
}: {
  task: TaskDto;
  agentName: string;
  agentNames: Map<string, string>;
  isReadOnly: boolean;
  header: ReactNode;
}) {
  const [inspector, setInspector] = useStoredChoice('fleet.task.inspector', PANEL_CHOICES, 'shown');
  const [isExpanded, setExpanded] = useState(false);
  const drawer = useInspectorDrawer();
  const mastheadHeight = useMastheadHeight();
  const isInspectorShown = inspector === 'shown';

  const canFollowUp = !isReadOnly && !isTaskActive(task.status) && !isTaskPlanned(task.status);

  return (
    <div
      style={{ height: `calc(100dvh - ${mastheadHeight}px - var(--status-bar-height))` }}
      className="-mx-4 -my-8 flex overflow-hidden bg-canvas lg:-mx-8"
    >
      <section aria-label="Detalle de la tarea" className="flex min-w-0 flex-1 flex-col">
        <div className={isExpanded ? 'hidden' : 'flex max-h-[35%] shrink flex-col md:max-h-[40%]'}>
          <div
            tabIndex={0}
            role="region"
            aria-label="Cabecera y resultado de la tarea"
            className={`min-h-0 flex-1 space-y-4 p-4 md:p-5 ${SCROLL_PANEL}`}
          >
            {header}
            {task.resultSummary && (
              // Collapsed by default so the conversation keeps most of the viewport.
              <ResultPanel key={task.resultSummary} task={task} defaultOpen={false} />
            )}
          </div>
        </div>
        <ConversationPanel
          task={task}
          agentName={agentName}
          isExpanded={isExpanded}
          onToggleExpanded={() => setExpanded((expanded) => !expanded)}
          canFollowUp={canFollowUp}
          trailing={
            <InspectorToggles
              isShown={isInspectorShown}
              onToggle={() => setInspector(isInspectorShown ? 'hidden' : 'shown')}
              isDrawerOpen={drawer.isOpen}
              onOpenDrawer={drawer.open}
              drawerOpenerRef={drawer.openerRef}
            />
          }
        />
      </section>

      {drawer.isOpen && (
        <div aria-hidden onClick={drawer.close} className="fixed inset-0 z-30 bg-canvas/70 xl:hidden" />
      )}
      <aside
        ref={drawer.panelRef}
        tabIndex={-1}
        aria-label="Inspector de tarea"
        onKeyDown={drawer.onKeyDown}
        style={drawer.isOpen ? { top: mastheadHeight } : undefined}
        className={`${inspectorLayout(drawer.isOpen, isInspectorShown)} flex-col border-l border-line bg-canvas outline-none`}
      >
        <TaskInspector
          task={task}
          agentNames={agentNames}
          onClose={drawer.isOpen ? drawer.close : undefined}
        />
      </aside>
    </div>
  );
}
