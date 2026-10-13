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

/** Capabilities the runtime exposes to the model as tools so it can coordinate with its team. */
export interface DelegationGateway {
  listCollaborators(): CollaboratorInfo[];
  delegate(request: DelegationRequest): Promise<DelegationOutcome>;
  reportResult(summary: string): void;
}

export interface AgentRunRequest {
  prompt: string;
  systemPromptAppendix: string;
  model: AgentModel;
  effort: AgentEffort;
  allowedTools: string[];
  permissionMode: AgentPermissionMode;
  maxTurns: number;
  workspacePath: string;
  resumeSessionId: string | null;
  signal: AbortSignal;
  delegation: DelegationGateway;
}

export interface RunUsage {
  numTurns: number;
  models: ModelTokenUsage[];
}

export type RuntimeEvent =
  | { type: 'session_started'; sessionId: string }
  | { type: 'message'; payload: MessagePayload }
  | { type: 'finished'; resultText: string; isError: boolean; usage: RunUsage | null };

export interface AgentRuntime {
  run(request: AgentRunRequest): AsyncIterable<RuntimeEvent>;
}
