import type { ProjectDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { groupProjects, memberNames, projectOptionLabel, summarizeProjects } from './projectListModel';

const project = (name: string, archivedAt: string | null = null): ProjectDto => ({
  id: name,
  organizationId: 'org',
  name,
  description: '',
  workspacePath: `/work/${name}`,
  memberIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt,
});

describe('project list model', () => {
  it('separates active from archived projects', () => {
    const { active, archived } = groupProjects([project('b'), project('a', '2026-02-01'), project('c')]);
    expect(active.map((p) => p.name)).toEqual(['b', 'c']);
    expect(archived.map((p) => p.name)).toEqual(['a']);
  });

  it('sorts active by name and archived by most recent archive date', () => {
    const { active, archived } = groupProjects([
      project('zeta'),
      project('Alfa'),
      project('old', '2026-01-10'),
      project('new', '2026-03-10'),
    ]);
    expect(active.map((p) => p.name)).toEqual(['Alfa', 'zeta']);
    expect(archived.map((p) => p.name)).toEqual(['new', 'old']);
  });

  it('does not mutate the input', () => {
    const input = [project('b'), project('a')];
    groupProjects(input);
    expect(input.map((p) => p.name)).toEqual(['b', 'a']);
  });

  it('flags archived projects in option labels', () => {
    expect(projectOptionLabel(project('a'))).toBe('a');
    expect(projectOptionLabel(project('a', '2026-02-01'))).toBe('a (archivado)');
  });
});

describe('summarizeProjects', () => {
  it('counts projects and distinct member agents', () => {
    const projects = [
      { ...project('a'), memberIds: ['1', '2'] },
      { ...project('b'), memberIds: ['2', '3'] },
    ];
    expect(summarizeProjects(projects)).toEqual({ activeProjects: 2, teamAgents: 3 });
    expect(summarizeProjects([])).toEqual({ activeProjects: 0, teamAgents: 0 });
  });
});

describe('memberNames', () => {
  it('maps member ids to names and skips unknown agents', () => {
    const agents = [
      { id: '1', name: 'Conde' },
      { id: '2', name: 'Acosa' },
    ];
    expect(memberNames({ ...project('a'), memberIds: ['2', 'x', '1'] }, agents)).toEqual(['Acosa', 'Conde']);
  });
});
