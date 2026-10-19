import type { ConversationMessageDto } from '@fleet/shared';
import { Bot, ChevronRight, Cpu, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Accordion } from '../../components/Accordion';
import { Markdown } from '../../components/Markdown';
import { EmptyState, type ChipTone } from '../../components/ui';
import { taskLabel } from './taskLabel';
import { buildTimeline, describeDelegation, shortToolName, type TimelineItem } from './conversationModel';

const MAX_PREVIEW = 6000;
const CODE_BLOCK =
  'max-h-96 max-w-full overflow-auto rounded-md border border-line bg-canvas p-3 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]';

const truncate = (text: string) => (text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}\n…` : text);

const formatTime = (isoDate: string | undefined) =>
  isoDate ? new Date(isoDate).toLocaleTimeString([], { hour12: false }) : '';

type MessageItem = Extract<TimelineItem, { type: 'message' }>;
type ToolItem = Extract<TimelineItem, { type: 'tool' }>;

function Avatar({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-sm border border-line-strong bg-surface-raised text-fg-muted [&>svg]:size-4"
    >
      {children}
    </span>
  );
}

function MessageHeader({ name, time, tag }: { name: string; time: string; tag?: string }) {
  return (
    <div className="mb-1 flex flex-wrap items-baseline gap-2">
      <span className="font-semibold text-fg">{name}</span>
      {time && <time className="font-mono text-xs text-fg-subtle">{time}</time>}
      {tag && (
        <span className="label-mono rounded-sm border border-line bg-surface-raised px-1.5 py-0.5 text-fg-muted">
          {tag}
        </span>
      )}
    </div>
  );
}

function ChatRow({ avatar, children }: { avatar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Avatar>{avatar}</Avatar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function MessageBubble({ item, time, agentName }: { item: MessageItem; time: string; agentName: string }) {
  const { payload } = item;
  switch (payload.kind) {
    case 'user':
      if (item.isInitialPrompt)
        return (
          <Accordion header={<span className="text-sm text-fg-muted">Prompt enviado al agente</span>}>
            <Markdown className="border-t border-line p-3">{payload.text}</Markdown>
          </Accordion>
        );
      return (
        <ChatRow avatar={<User />}>
          <div className="rounded-lg border border-line-strong bg-surface-raised p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="label-mono text-accent">Instrucción de proyecto // ENCARGO</span>
                <span className="rounded-sm border border-line bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg-muted">
                  project_manager
                </span>
              </p>
              {time && <time className="font-mono text-xs text-fg-subtle">{time}</time>}
            </div>
            <Markdown>{payload.text}</Markdown>
          </div>
        </ChatRow>
      );
    case 'assistant_text':
      return (
        <ChatRow avatar={<Bot />}>
          <MessageHeader name={agentName} time={time} />
          <Markdown>{payload.text}</Markdown>
        </ChatRow>
      );
    case 'system':
      return (
        <p className="flex items-center gap-2 border border-line bg-surface px-3 py-1.5 font-mono text-xs text-fg-subtle [overflow-wrap:anywhere]">
          <Cpu aria-hidden className="size-3.5 shrink-0" />
          {payload.text}
        </p>
      );
    case 'result':
      return (
        <ChatRow avatar={<Bot />}>
          <MessageHeader name={agentName} time={time} tag={payload.isError ? 'Error' : 'Respuesta final'} />
          <div
            className={`rounded-lg border p-4 ${payload.isError ? 'border-danger-line bg-danger-soft' : 'border-success-line bg-success-soft'}`}
          >
            <Markdown>{payload.text}</Markdown>
          </div>
        </ChatRow>
      );
  }
}

function toolTone(item: ToolItem): ChipTone {
  if (!item.result) return 'warning';
  return item.result.isError ? 'danger' : 'success';
}

function ToolHeader({ item }: { item: ToolItem }) {
  const delegation = describeDelegation(item.call, item.result);
  return (
    <>
      <code className="shrink-0 font-mono text-sm font-bold text-fg">
        {shortToolName(item.call.toolName)}
      </code>
      {delegation && (
        <span className="min-w-0 truncate text-sm text-fg-muted">
          → <strong className="text-fg">{delegation.collaborator}</strong>: {delegation.title}
        </span>
      )}
    </>
  );
}

function DelegationLink({ item, projectId }: { item: ToolItem; projectId: string }) {
  const delegation = describeDelegation(item.call, item.result);
  if (!delegation?.subtaskId) return null;
  return (
    <Link
      to={`/projects/${projectId}/tasks/${delegation.subtaskId}`}
      className="flex shrink-0 items-center gap-0.5 text-xs text-accent hover:underline"
    >
      {delegation.subtaskNumber ? `ver ${taskLabel(delegation.subtaskNumber)}` : 'ver conversación'}
      <ChevronRight aria-hidden className="size-3" />
    </Link>
  );
}

function ToolStep({
  item,
  projectId,
  open,
  onToggle,
}: {
  item: ToolItem;
  projectId: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const isDelegation = describeDelegation(item.call, item.result) !== null;
  return (
    <Accordion
      open={open}
      onToggle={onToggle}
      bar={toolTone(item)}
      pulseBar={!item.result}
      header={<ToolHeader item={item} />}
      trailing={<DelegationLink item={item} projectId={projectId} />}
      bodyClassName="border-t border-line bg-canvas/60"
    >
      <div className="grid min-w-0 gap-3 p-3 lg:grid-cols-2">
        <section className="min-w-0">
          <p className="label-mono mb-1 text-fg-subtle">Entrada</p>
          <pre className={`${CODE_BLOCK} text-fg-muted`}>
            {truncate(JSON.stringify(item.call.input, null, 2))}
          </pre>
        </section>
        <section className="min-w-0">
          <p className="label-mono mb-1 text-fg-subtle">Resultado</p>
          {!item.result ? (
            <p className="text-xs text-warning">En curso…</p>
          ) : isDelegation ? (
            <Markdown className="max-h-96 overflow-auto rounded-md border border-line bg-canvas p-3">
              {item.result.content}
            </Markdown>
          ) : (
            <pre className={`${CODE_BLOCK} text-fg`}>{truncate(item.result.content)}</pre>
          )}
        </section>
      </div>
    </Accordion>
  );
}

export function ConversationView({
  messages,
  projectId,
  agentName,
  openTools,
  onToolToggle,
}: {
  messages: ConversationMessageDto[];
  projectId: string;
  agentName: string;
  openTools: ReadonlySet<string>;
  onToolToggle: (toolId: string, open: boolean) => void;
}) {
  const createdAt = new Map(messages.map((message) => [message.id, message.createdAt]));

  return (
    <div className="min-w-0 space-y-4">
      {messages.length === 0 && (
        <EmptyState>La conversación aparecerá aquí en cuanto el agente empiece.</EmptyState>
      )}
      {buildTimeline(messages).map((item) =>
        item.type === 'tool' ? (
          <ToolStep
            key={item.id}
            item={item}
            projectId={projectId}
            open={openTools.has(item.id)}
            onToggle={(open) => onToolToggle(item.id, open)}
          />
        ) : (
          <MessageBubble
            key={item.id}
            item={item}
            time={formatTime(createdAt.get(item.id))}
            agentName={agentName}
          />
        ),
      )}
    </div>
  );
}
