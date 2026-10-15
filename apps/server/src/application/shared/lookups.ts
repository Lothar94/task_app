import type { Agent } from '../../domain/agent/Agent.js';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors/DomainError.js';
import type { Project } from '../../domain/project/Project.js';
import type { Task } from '../../domain/task/Task.js';
import type { Organization } from '../../domain/organization/Organization.js';
import type { AgentRepository } from '../ports/AgentRepository.js';
import type { OrganizationRepository } from '../ports/OrganizationRepository.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type { TaskRepository } from '../ports/TaskRepository.js';

export function requireOrganization(organizations: OrganizationRepository, id: string): Organization {
  const organization = organizations.findById(id);
  if (!organization) throw new NotFoundError('Organization', id);
  return organization;
}

export function requireAgent(agents: AgentRepository, id: string): Agent {
  const agent = agents.findById(id);
  if (!agent) throw new NotFoundError('Agent', id);
  return agent;
}

export function requireAgents(agents: AgentRepository, ids: readonly string[]): Agent[] {
  return ids.map((id) => requireAgent(agents, id));
}

/** Looks the agents up and rejects (400) any that belongs to another organization. */
export function requireAgentsOfOrganization(
  agents: AgentRepository,
  organizationId: string,
  ids: readonly string[],
): Agent[] {
  const found = requireAgents(agents, ids);
  const foreign = found.find((agent) => agent.organizationId !== organizationId);
  if (foreign) throw new ValidationError(`Agent "${foreign.name}" belongs to another organization`);
  return found;
}

export function requireProject(projects: ProjectRepository, id: string): Project {
  const project = projects.findById(id);
  if (!project) throw new NotFoundError('Project', id);
  return project;
}

/** Looks the project up and rejects (409) archived ones: they are read-only. */
export function requireActiveProject(projects: ProjectRepository, id: string): Project {
  const project = requireProject(projects, id);
  project.ensureActive();
  return project;
}

export function requireTask(tasks: TaskRepository, id: string): Task {
  const task = tasks.findById(id);
  if (!task) throw new NotFoundError('Task', id);
  return task;
}

/** Planning operations only apply to root tasks: subtasks are managed by delegation. */
export function requireRootTask(tasks: TaskRepository, id: string): Task {
  const task = requireTask(tasks, id);
  if (task.parentTaskId !== null) throw new ConflictError('Subtasks are managed by their parent task');
  return task;
}

export function requirePlannedRootTask(tasks: TaskRepository, id: string): Task {
  const task = requireRootTask(tasks, id);
  if (!task.isPlanned) throw new ConflictError(`Task "${id}" is not a draft or queued`);
  return task;
}
