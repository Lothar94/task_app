import { isAbsolute } from 'node:path';
import { ConflictError, ValidationError } from '../errors/DomainError.js';
import { requireText } from '../shared/guards.js';

export interface ProjectDetails {
  name: string;
  description: string;
  workspacePath: string;
}

export interface ProjectSnapshot extends ProjectDetails {
  id: string;
  organizationId: string;
  memberIds: string[];
  createdAt: Date;
  archivedAt: Date | null;
}

export class Project {
  private constructor(private state: ProjectSnapshot) {}

  static create(
    id: string,
    organizationId: string,
    details: ProjectDetails,
    memberIds: string[],
    now: Date,
  ): Project {
    const project = new Project({
      id,
      organizationId,
      ...Project.validateDetails(details),
      memberIds: [],
      createdAt: now,
      archivedAt: null,
    });
    project.setMembers(memberIds);
    return project;
  }

  static restore(snapshot: ProjectSnapshot): Project {
    return new Project({ ...snapshot, memberIds: [...snapshot.memberIds] });
  }

  get id(): string {
    return this.state.id;
  }

  get organizationId(): string {
    return this.state.organizationId;
  }

  get workspacePath(): string {
    return this.state.workspacePath;
  }

  get memberIds(): readonly string[] {
    return this.state.memberIds;
  }

  get isArchived(): boolean {
    return this.state.archivedAt !== null;
  }

  /** Archived projects are read-only: mutating operations call this first. */
  ensureActive(): void {
    if (this.isArchived) throw new ConflictError(`Project "${this.state.name}" is archived`);
  }

  /** Idempotent: archiving an archived project keeps the original date. */
  archive(now: Date): void {
    if (this.isArchived) return;
    this.state = { ...this.state, archivedAt: now };
  }

  unarchive(): void {
    this.state = { ...this.state, archivedAt: null };
  }

  hasMember(agentId: string): boolean {
    return this.state.memberIds.includes(agentId);
  }

  setMembers(memberIds: string[]): void {
    this.state = { ...this.state, memberIds: [...new Set(memberIds)] };
  }

  removeMember(agentId: string): void {
    this.setMembers(this.state.memberIds.filter((id) => id !== agentId));
  }

  toSnapshot(): ProjectSnapshot {
    return { ...this.state, memberIds: [...this.state.memberIds] };
  }

  private static validateDetails(details: ProjectDetails): ProjectDetails {
    const workspacePath = requireText(details.workspacePath, 'workspacePath', 1024);
    if (!isAbsolute(workspacePath)) {
      throw new ValidationError('workspacePath must be an absolute path');
    }
    return {
      name: requireText(details.name, 'name', 120),
      description: details.description.trim(),
      workspacePath,
    };
  }
}
