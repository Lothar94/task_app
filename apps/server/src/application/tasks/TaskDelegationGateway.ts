import type { Task } from '../../domain/task/Task.js';
import type {
  CollaboratorInfo,
  DelegationGateway,
  DelegationOutcome,
  DelegationRequest,
} from '../ports/AgentRuntime.js';
import type { DelegateSubtask } from './DelegateSubtask.js';
import type { TaskExecutor } from './TaskExecutor.js';
import type { TaskRecorder } from './TaskRecorder.js';

/** Binds the delegation capabilities offered to a running agent to its own task. */
export class TaskDelegationGateway implements DelegationGateway {
  constructor(
    private readonly task: Task,
    private readonly collaborators: CollaboratorInfo[],
    private readonly delegateSubtask: DelegateSubtask,
    private readonly executor: TaskExecutor,
    private readonly recorder: TaskRecorder,
    private readonly signal: AbortSignal,
  ) {}

  listCollaborators(): CollaboratorInfo[] {
    return this.collaborators;
  }

  delegate(request: DelegationRequest): Promise<DelegationOutcome> {
    return this.delegateSubtask.execute({
      parent: this.task,
      request,
      executor: this.executor,
      signal: this.signal,
    });
  }

  reportResult(summary: string): void {
    this.task.reportResult(summary);
    this.recorder.recordChange(this.task);
  }
}
