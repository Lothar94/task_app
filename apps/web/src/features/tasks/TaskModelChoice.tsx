import type { TaskDto } from '@fleet/shared';
import { useAgents } from '../agents/agentQueries';
import { modelChoiceSummary } from './taskFormModel';

/** Meta line with the model/effort the invoker chose; renders nothing for fixed agents. */
export function TaskModelChoice({ task }: { task: Pick<TaskDto, 'agentId' | 'modelChoice'> }) {
  const { data: agents } = useAgents();
  const summary = modelChoiceSummary(agents?.find((agent) => agent.id === task.agentId), task.modelChoice);
  return summary && <span>{summary}</span>;
}
