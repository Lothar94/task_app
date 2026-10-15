import { describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/domain/errors/DomainError.js';
import { Project } from '../../src/domain/project/Project.js';

const created = new Date('2026-01-01T00:00:00Z');
const archivedOn = new Date('2026-02-01T00:00:00Z');

const newProject = () =>
  Project.create('p1', 'org', { name: 'Demo', description: '', workspacePath: '/tmp/demo' }, ['a1'], created);

describe('Project archiving', () => {
  it('starts active', () => {
    const project = newProject();

    expect(project.isArchived).toBe(false);
    expect(project.toSnapshot().archivedAt).toBeNull();
    expect(() => project.ensureActive()).not.toThrow();
  });

  it('archives with the given date and refuses further changes', () => {
    const project = newProject();

    project.archive(archivedOn);

    expect(project.isArchived).toBe(true);
    expect(project.toSnapshot().archivedAt).toEqual(archivedOn);
    expect(() => project.ensureActive()).toThrow(ConflictError);
    expect(() => project.ensureActive()).toThrow('Project "Demo" is archived');
  });

  it('keeps the original date when archived again', () => {
    const project = newProject();
    project.archive(archivedOn);

    project.archive(new Date('2026-03-01T00:00:00Z'));

    expect(project.toSnapshot().archivedAt).toEqual(archivedOn);
  });

  it('unarchives, and unarchiving an active project is a no-op', () => {
    const project = newProject();
    project.archive(archivedOn);

    project.unarchive();
    project.unarchive();

    expect(project.isArchived).toBe(false);
    expect(() => project.ensureActive()).not.toThrow();
  });

  it('still lets members be removed while archived', () => {
    const project = newProject();
    project.archive(archivedOn);

    project.removeMember('a1');

    expect(project.memberIds).toEqual([]);
  });
});
