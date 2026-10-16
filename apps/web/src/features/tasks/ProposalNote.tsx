import type { TaskDto } from '@fleet/shared';
import { awaitsConfirmation, proposalLabel } from './taskListModel';

interface ProposalNoteProps {
  task: Pick<TaskDto, 'proposedByAgentId' | 'status'>;
  agentNames: Map<string, string>;
  /** Also explain how to confirm the proposal (task page). */
  detailed?: boolean;
}

/** Marks tasks an agent proposed and, while still a draft, that the project manager must confirm them. */
export function ProposalNote({ task, agentNames, detailed = false }: ProposalNoteProps) {
  const label = proposalLabel(task, agentNames);
  if (label === null) return null;
  const pending = awaitsConfirmation(task);
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-xs text-amber-300">
      <span>{label}</span>
      {pending && <span className="font-semibold">· Pendiente de confirmación</span>}
      {pending && detailed && (
        <span className="text-zinc-400">
          No empezará hasta que la confirmes con «Iniciar» o «Encolar».
        </span>
      )}
    </span>
  );
}
