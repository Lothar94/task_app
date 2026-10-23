import type { AgentActivityDto, AgentDto, FleetEvent } from '@fleet/shared';

/** A complete AgentDto for tests; `patch` overrides any field. */
export const agentFixture = (patch: Partial<AgentDto> = {}): AgentDto => ({
  id: 'a1',
  organizationId: 'org',
  name: 'Ada',
  role: 'Backend',
  description: '',
  instructions: 'Escribe código.',
  model: 'sonnet',
  effort: 'high',
  modelSelection: 'fixed',
  allowedTools: ['Read', 'Write'],
  skills: [],
  permissionMode: 'dontAsk',
  maxTurns: 50,
  temperature: null,
  maxOutputTokens: null,
  mcpServers: [],
  enabled: true,
  collaboratorIds: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

export const activityFixture = (patch: Partial<AgentActivityDto> = {}): AgentActivityDto => ({
  organizationId: 'org',
  agents: [],
  delegations: [],
  generatedAt: '2026-10-23T10:00:00.000Z',
  ...patch,
});

export const activityEvent = (activity: AgentActivityDto = activityFixture()): FleetEvent => ({
  type: 'agent.activity',
  organizationId: activity.organizationId,
  activity,
});
