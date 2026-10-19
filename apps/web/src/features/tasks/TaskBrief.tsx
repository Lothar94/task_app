import type { TaskDto } from '@fleet/shared';
import { useId } from 'react';
import { Markdown } from '../../components/Markdown';
import { hasDescription } from './conversationModel';
import { taskLabel } from './taskLabel';

export function TaskBrief({ task }: { task: Pick<TaskDto, 'number' | 'title' | 'description'> }) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className="rounded-lg border border-line-strong bg-surface-raised p-4 shadow-float"
    >
      <p className="label-mono mb-2 text-accent">Encargo</p>
      <h3 id={titleId} className="mb-2 font-semibold text-fg">
        {taskLabel(task.number)}: {task.title}
      </h3>
      {hasDescription(task.description) ? (
        <Markdown>{task.description}</Markdown>
      ) : (
        <p className="text-sm text-fg-subtle">Sin descripción.</p>
      )}
    </article>
  );
}
