import type { ConversationMessageDto, TaskDto } from '@fleet/shared';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Markdown } from '../../components/Markdown';
import { EmptyState } from '../../components/ui';
import { taskLabel } from './taskLabel';
import {
  buildTimeline,
  describeDelegation,
  hasDescription,   shortToolName,
  type TimelineItem,
} from './conversationModel';

const MAX_PREVIEW = 6000;
const CODE_BLOCK =
  'max-h-96 max-w-full overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]';

const truncate = (text: string) => (text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}\n…` : text);

function MessageBubble({ item }: { item: Extract<TimelineItem, { type: 'message' }> }) {
  const { payload } = item;
  switch (payload.kind) {
    case 'user':
      if (item.isInitialPrompt)
        return (
          <details className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
            <summary className="cursor-pointer text-zinc-400">Prompt enviado al agente</summary>
            <Markdown className="mt-3">{payload.text}</Markdown>
          </details>
        );
      return (
        <div className="rounded-lg border border-indigo-900 bg-indigo-950/40 p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-300 uppercase">Encargo</p>
          <Markdown>{payload.text}</Markdown>
        </div>
      );
    case 'assistant_text':
      return <Markdown className="px-1">{payload.text}</Markdown>;
    case 'system':
      return <p className="text-xs text-zinc-500">{payload.text}</p>;
    case 'result':
      return (
        <div
          className={`rounded-lg border p-4 ${payload.isError ? 'border-red-900 bg-red-950/40' : 'border-emerald-900 bg-emerald-950/30'}`}
        >
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            {payload.isError ? 'Error' : 'Respuesta final'}
          </p>
          <Markdown>{payload.text}</Markdown>
        </div>
      );
  }
}

type BriefTask = Pick<TaskDto, 'number' | 'title' | 'description'>;

function TaskBrief({ task }: { task: BriefTask }) {
  return (
    <article
      aria-labelledby="task-brief-title"
      className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Tarea</p>
      <h3 id="task-brief-title" className="mb-2 font-semibold text-zinc-100">
        {taskLabel(task.number)}: {task.title}
      </h3>
      {hasDescription(task.description) ? (
        <Markdown>{task.description}</Markdown>
      ) : (
        <p className="text-sm text-zinc-500">Sin descripción.</p>
      )}
    </article>
  );
}

function ToolSummary({
  item,
  projectId,
}: {
  item: Extract<TimelineItem, { type: 'tool' }>;
  projectId: string;
}) {
  const delegation = describeDelegation(item.call, item.result);
  const status = item.result
    ? item.result.isError
      ? 'text-red-400'
      : 'text-emerald-400'
    : 'animate-pulse text-amber-400';
  return (
    <summary className="flex min-w-0 cursor-pointer items-center gap-2 px-3 py-2">
      <span className={`shrink-0 ${status}`}>●</span>
      <code className="shrink-0 text-zinc-300">{shortToolName(item.call.toolName)}</code>
      {delegation && (
        <span className="min-w-0 truncate text-zinc-400">
          → <strong className="text-zinc-200">{delegation.collaborator}</strong>: {delegation.title}
        </span>
      )}
      {delegation?.subtaskId && (
        <Link
          to={`/projects/${projectId}/tasks/${delegation.subtaskId}`}
          className="ml-auto shrink-0 text-xs text-indigo-300 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {delegation.subtaskNumber ? `ver ${taskLabel(delegation.subtaskNumber)}` : 'ver conversación'}
        </Link>
      )}
    </summary>
  );
}

function ToolStep({ item, projectId }: { item: Extract<TimelineItem, { type: 'tool' }>; projectId: string }) {
  const isDelegation = describeDelegation(item.call, item.result) !== null;
  return (
    <details className="group w-full min-w-0 rounded-md border border-zinc-800 bg-zinc-900/80 text-sm">
      <ToolSummary item={item} projectId={projectId} />
      <div className="grid min-w-0 gap-3 border-t border-zinc-800 p-3 lg:grid-cols-2">
        <section className="min-w-0">
          <p className="mb-1 text-xs text-zinc-500">Entrada</p>
          <pre className={`${CODE_BLOCK} text-zinc-400`}>
            {truncate(JSON.stringify(item.call.input, null, 2))}
          </pre>
        </section>
        <section className="min-w-0">
          <p className="mb-1 text-xs text-zinc-500">Resultado</p>
          {!item.result ? (
            <p className="text-xs text-amber-400">En curso…</p>
          ) : isDelegation ? (
            <Markdown className="max-h-96 overflow-auto rounded-md bg-zinc-950 p-3">
              {item.result.content}
            </Markdown>
          ) : (
            <pre className={`${CODE_BLOCK} text-zinc-300`}>{truncate(item.result.content)}</pre>
          )}
        </section>
      </div>
    </details>
  );
}

export function ConversationView({
  messages,
  projectId,
  task,
}: {
  messages: ConversationMessageDto[];
  projectId: string;
  task: BriefTask;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  return (
    <div className="min-w-0 space-y-3">
      <TaskBrief task={task} />
      {messages.length === 0 && (
        <EmptyState>La conversación aparecerá aquí en cuanto el agente empiece.</EmptyState>
      )}
      {buildTimeline(messages).map((item) =>
        item.type === 'tool' ? (
          <ToolStep key={item.id} item={item} projectId={projectId} />
        ) : (
          <MessageBubble key={item.id} item={item} />
        ),
      )}
      <div ref={endRef} />
    </div>
  );
}
