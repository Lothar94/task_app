import type { Task } from '../../domain/task/Task.js';
import type {
  CollaboratorInfo,
  DelegationGateway,
  DelegationOutcome,
  DelegationRequest,
  ProposedTaskInfo,
  TaskProposal,
} from '../ports/AgentRuntime.js';
import type { DelegateSubtask } from './DelegateSubtask.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import { requireAgent } from '../shared/lookups.js';
import type { ProposeTask } from './ProposeTask.js';
import type { TaskExecutor } from './TaskExecutor.js';
import type { TaskRecorder } from './TaskRecorder.js';

export interface GatewayServices {
  delegateSubtask: DelegateSubtask;
  proposeTask: ProposeTask;
  agents: AgentRepository;
}

/** Binds the delegation capabilities offered to a running agent to its own task. */
export class TaskDelegationGateway implements DelegationGateway {
  constructor(
    private readonly task: Task,
    private readonly collaborators: CollaboratorInfo[],
    private readonly services: GatewayServices,
    private readonly executor: TaskExecutor,
    private readonly recorder: TaskRecorder,
    private readonly signal: AbortSignal,
  ) {}

  listCollaborators(): CollaboratorInfo[] {
    return this.collaborators;
  }

  delegate(request: DelegationRequest): Promise<DelegationOutcome> {
    return this.services.delegateSubtask.execute({
      parent: this.task,
      request,
      executor: this.executor,
      signal: this.signal,
    });
  }

  proposeTask(proposal: TaskProposal): ProposedTaskInfo {
    const proposed = this.services.proposeTask.execute({ proposer: this.task, request: proposal });
    return {
      taskId: proposed.id,
      taskNumber: proposed.number,
      assigneeName: requireAgent(this.services.agents, proposed.agentId).name,
    };
  }

  reportResult(summary: string): void {
    this.task.reportResult(summary);
    this.recorder.recordChange(this.task);
  }
}
