import type {
  AgentEffort,
  AgentModel,
  ModelTokenUsage,
  AgentPermissionMode,
  MessagePayload,
} from '@fleet/shared';

export interface CollaboratorInfo {
  name: string;
  role: string;
  description: string;
}

export interface DelegationRequest {
  collaboratorName: string;
  title: string;
  instructions: string;
}

export interface DelegationOutcome {
  subtaskId: string;
  subtaskNumber: number;
  status: 'completed' | 'failed' | 'cancelled';
  summary: string;
}

export interface TaskProposal {
  title: string;
  description: string;
  assigneeName?: string;
  milestone?: string;
  tags?: string[];
}

export interface ProposedTaskInfo {
  taskId: string;
  taskNumber: number;
  assigneeName: string;
}

/** Capabilities the runtime exposes to the model as tools so it can coordinate with its team. */
export interface DelegationGateway {
  listCollaborators(): CollaboratorInfo[];
  delegate(request: DelegationRequest): Promise<DelegationOutcome>;
  proposeTask(proposal: TaskProposal): ProposedTaskInfo;
  reportResult(summary: string): void;
}

export interface AgentRunRequest {
  prompt: string;
  systemPromptAppendix: string;
  model: AgentModel;
  effort: AgentEffort;
  allowedTools: string[];
  /** Skills the agent must use; empty disables skills. */
  skills: string[];
  /** Directory whose `.claude/skills` links the agent's skills, or null when there is none. */
  skillsDirectory: string | null;
  /** Install paths of the plugins that provide the agent's `plugin:skill` skills. */
  pluginPaths: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  workspacePath: string;
  resumeSessionId: string | null;
  signal: AbortSignal;
  delegation: DelegationGateway;
}

export interface RunUsage {
  numTurns: number;
  /** Time spent waiting for the model API (SDK `duration_api_ms`); null when unknown. */
  apiDurationMs: number | null;
  models: ModelTokenUsage[];
}

export type RuntimeEvent =
  | { type: 'session_started'; sessionId: string }
  | { type: 'message'; payload: MessagePayload }
  | { type: 'finished'; resultText: string; isError: boolean; usage: RunUsage | null };

export interface AgentRuntime {
  run(request: AgentRunRequest): AsyncIterable<RuntimeEvent>;
}
