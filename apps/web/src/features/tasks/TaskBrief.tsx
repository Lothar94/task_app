import type { TaskDto } from '@fleet/shared';
import { useId } from 'react';
import { Markdown } from '../../components/Markdown';
import { hasDescription } from './conversationModel';
import { taskLabel } from './taskLabel';

export function TaskBrief({ task }: { task: Pick<TaskDto, 'number' | 'title' | 'description'> }) {
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Tarea</p>
      <h3 id={titleId} className="mb-2 font-semibold text-zinc-100">
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
