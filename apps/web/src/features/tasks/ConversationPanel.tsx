import type { ConversationMessageDto, TaskDto } from '@fleet/shared';
import { type ReactNode, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/ui';
import { ConversationHeader } from './ConversationHeader';
import { ConversationView } from './ConversationView';
import { buildTimeline, toolStepIds } from './conversationModel';
import { FollowUpForm } from './FollowUpForm';
import { TaskBrief } from './TaskBrief';
import { SCROLL_PANEL } from './taskPanelStyles';
import { useStickToBottom } from './stickToBottom';
import { useConversation } from './taskQueries';

function ConversationScroller({
  task,
  messages,
  agentName,
  openTools,
  onToolToggle,
}: {
  task: TaskDto;
  messages: ConversationMessageDto[];
  agentName: string;
  openTools: ReadonlySet<string>;
  onToolToggle: (toolId: string, open: boolean) => void;
}) {
  const { ref, onScroll } = useStickToBottom<HTMLDivElement>(messages.length);
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      tabIndex={0}
      role="region"
      aria-label="Mensajes de la conversación"
      className={`min-h-0 flex-1 space-y-4 p-4 md:p-5 ${SCROLL_PANEL}`}
    >
      <TaskBrief task={task} />
      <ConversationView
        messages={messages}
        projectId={task.projectId}
        agentName={agentName}
        openTools={openTools}
        onToolToggle={onToolToggle}
      />
    </div>
  );
}

/**
 * Conversation block: its own scroll area (sticking to the newest message) with the follow-up
 * console pinned underneath, outside the scroll.
 */
export function ConversationPanel({
  task,
  agentName,
  isExpanded,
  onToggleExpanded,
  canFollowUp,
  trailing,
}: {
  task: TaskDto;
  agentName: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  canFollowUp: boolean;
  trailing?: ReactNode;
}) {
  const conversation = useConversation(task.id);
  const [openTools, setOpenTools] = useState<ReadonlySet<string>>(new Set());
  const toolIds = conversation.data ? toolStepIds(buildTimeline(conversation.data)) : [];

  const toggleTool = (toolId: string, open: boolean) =>
    setOpenTools((current) => {
      const next = new Set(current);
      if (open) next.add(toolId);
      else next.delete(toolId);
      return next;
    });

  return (
    <section aria-label="Conversación de la tarea" className="flex min-h-0 flex-1 flex-col">
      <ConversationHeader
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        canToggleTools={toolIds.length > 0}
        onExpandTools={() => setOpenTools(new Set(toolIds))}
        onCollapseTools={() => setOpenTools(new Set())}
        trailing={trailing}
      />
      {conversation.isPending ? (
        <div className="p-5">
          <Loading />
        </div>
      ) : conversation.error ? (
        <div className="p-5">
          <ErrorMessage error={conversation.error} />
        </div>
      ) : (
        <ConversationScroller
          task={task}
          messages={conversation.data}
          agentName={agentName}
          openTools={openTools}
          onToolToggle={toggleTool}
        />
      )}
      {canFollowUp && (
        <div className="shrink-0 border-t border-line bg-canvas p-3">
          <FollowUpForm taskId={task.id} />
        </div>
      )}
    </section>
  );
}
