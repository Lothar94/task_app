import type { TaskDto } from '@fleet/shared';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { ConversationPanel } from './ConversationPanel';
import { ResultPanel } from './ResultPanel';
import { type AnchorId, TaskAnchors } from './TaskAnchors';
import { TaskInspector } from './TaskInspector';
import { InspectorToggles, SidebarToggle } from './TaskPanelToggles';
import { TaskSidebar } from './TaskSidebar';
import { isTaskActive, isTaskPlanned } from './TaskStatusBadge';
import { useMastheadHeight } from './useMastheadHeight';
import { prefersReducedMotion } from './stickToBottom';
import { SCROLL_PANEL, anchorDomId } from './taskPanelStyles';

const PANEL_CHOICES = ['shown', 'hidden'] as const;
const WIDE_QUERY = '(min-width: 1280px)';

function scrollToAnchor(id: AnchorId) {
  document
    .getElementById(anchorDomId(id))
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/**
 * Viewport-high workspace of the task page (masthead excluded): navigation rail, central column
 * and inspector, each scrolling on its own. Below 1280px the rail becomes a tab row and the
 * inspector a drawer.
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
  const [sidebar, setSidebar] = useStoredChoice('fleet.task.sidebar', PANEL_CHOICES, 'shown');
  const [inspector, setInspector] = useStoredChoice('fleet.task.inspector', PANEL_CHOICES, 'shown');
  const [isExpanded, setExpanded] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<AnchorId>('overview');
  const mastheadHeight = useMastheadHeight();
  const drawerOpener = useRef<HTMLSpanElement>(null);
  const inspectorPanel = useRef<HTMLElement>(null);
  const isSidebarShown = sidebar === 'shown';
  const isInspectorShown = inspector === 'shown';

  useEffect(() => {
    if (isDrawerOpen) inspectorPanel.current?.focus();
  }, [isDrawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerOpener.current?.querySelector('button')?.focus();
  };

  const handleDrawerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isDrawerOpen) closeDrawer();
  };

  const goTo = (id: AnchorId) => {
    setActive(id);
    if (id === 'subtasks') {
      if (window.matchMedia(WIDE_QUERY).matches) setInspector('shown');
      else setDrawerOpen(true);
    } else setExpanded(false);
    requestAnimationFrame(() => scrollToAnchor(id));
  };

  const canFollowUp = !isReadOnly && !isTaskActive(task.status) && !isTaskPlanned(task.status);
  const asideLayout = isDrawerOpen ? 'fixed right-0 bottom-0 z-40 flex w-[min(22rem,100vw)]' : 'hidden';
  const asideWide = isInspectorShown ? 'xl:static xl:z-auto xl:flex xl:w-[340px] xl:shrink-0' : 'xl:hidden';

  return (
    <div
      style={{ height: `calc(100dvh - ${mastheadHeight}px)` }}
      className="-mx-4 -my-8 flex overflow-hidden bg-canvas lg:-mx-8"
    >
      <aside
        aria-label="Navegación de la tarea"
        className={`${isSidebarShown ? 'xl:flex' : ''} hidden w-60 shrink-0 flex-col border-r border-line bg-canvas`}
      >
        <TaskSidebar task={task} agentName={agentName} active={active} onSelect={goTo} />
      </aside>

      <section aria-label="Detalle de la tarea" className="flex min-w-0 flex-1 flex-col">
        <div className={isExpanded ? 'hidden' : 'flex max-h-[35%] shrink flex-col md:max-h-[40%]'}>
          <div className="shrink-0 border-b border-line xl:hidden">
            <TaskAnchors variant="tabs" active={active} onSelect={goTo} />
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Cabecera y resultado de la tarea"
            className={`min-h-0 flex-1 space-y-4 p-4 md:p-5 ${SCROLL_PANEL}`}
          >
            <div id={anchorDomId('overview')}>{header}</div>
            {task.resultSummary && (
              <div id={anchorDomId('result')}>
                <ResultPanel key={task.resultSummary} task={task} />
              </div>
            )}
          </div>
        </div>
        <ConversationPanel
          task={task}
          agentName={agentName}
          isExpanded={isExpanded}
          onToggleExpanded={() => setExpanded((expanded) => !expanded)}
          canFollowUp={canFollowUp}
          leading={
            <SidebarToggle
              isShown={isSidebarShown}
              onToggle={() => setSidebar(isSidebarShown ? 'hidden' : 'shown')}
            />
          }
          trailing={
            <InspectorToggles
              isShown={isInspectorShown}
              onToggle={() => setInspector(isInspectorShown ? 'hidden' : 'shown')}
              isDrawerOpen={isDrawerOpen}
              onOpenDrawer={() => setDrawerOpen(true)}
              drawerOpenerRef={drawerOpener}
            />
          }
        />
      </section>

      {isDrawerOpen && (
        <div aria-hidden onClick={closeDrawer} className="fixed inset-0 z-30 bg-canvas/70 xl:hidden" />
      )}
      <aside
        ref={inspectorPanel}
        tabIndex={-1}
        aria-label="Inspector de tarea"
        onKeyDown={handleDrawerKeyDown}
        style={isDrawerOpen ? { top: mastheadHeight } : undefined}
        className={`${asideLayout} ${asideWide} flex-col border-l border-line bg-canvas outline-none`}
      >
        <TaskInspector task={task} agentNames={agentNames} onClose={isDrawerOpen ? closeDrawer : undefined} />
      </aside>
    </div>
  );
}
