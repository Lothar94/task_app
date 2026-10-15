import type { AgentDto, ConversationMessageDto, OrganizationDto, ProjectDto, TaskDto } from '@fleet/shared';
import type { Agent } from '../../domain/agent/Agent.js';
import type { ConversationMessage } from '../../domain/conversation/ConversationMessage.js';
import type { Organization } from '../../domain/organization/Organization.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';

const toIso = (date: Date | null): string | null => date?.toISOString() ?? null;

export function toAgentDto(agent: Agent): AgentDto {
  const { createdAt, updatedAt, ...rest } = agent.toSnapshot();
  return { ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function toOrganizationDto(organization: Organization): OrganizationDto {
  const { createdAt, updatedAt, ...rest } = organization.toSnapshot();
  return { ...rest, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

export function toProjectDto(project: Project): ProjectDto {
  const { createdAt, archivedAt, ...rest } = project.toSnapshot();
  return { ...rest, createdAt: createdAt.toISOString(), archivedAt: toIso(archivedAt) };
}

export function toTaskDto(task: Task): TaskDto {
  const { createdAt, startedAt, finishedAt, sessionId: _sessionId, ...rest } = task.toSnapshot();
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    startedAt: toIso(startedAt),
    finishedAt: toIso(finishedAt),
  };
}

export function toMessageDto(message: ConversationMessage): ConversationMessageDto {
  return { ...message, createdAt: message.createdAt.toISOString() };
}
