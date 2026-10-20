import type { ProjectDto, ProjectTelemetryDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  groupProjects,
  memberNames,
  projectOptionLabel,
  sortProjects,
  summarizeProjects,
  swarmLabel,
  weeklyDeltaLabel,
} from './projectListModel';

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

const telemetry = (projectId: string, patch: Partial<ProjectTelemetryDto> = {}): ProjectTelemetryDto => ({
  projectId,
  status: 'idle',
  counts: { total: 0, completed: 0, active: 0, failed: 0, cancelled: 0, planned: 0 },
  successRate: null,
  totalTokens: 0,
  costUsd: 0,
  agentTimeMs: 0,
  lastActivityAt: null,
  activeAgentIds: [],
  activeSubtask: null,
  alerts: [],
  ...patch,
});
const byId = (...items: ProjectTelemetryDto[]) => new Map(items.map((item) => [item.projectId, item]));
const names = (projects: ProjectDto[]) => projects.map((p) => p.name);

describe('groupProjects alerts tab', () => {
  it('lists only non-archived projects with alerts', () => {
    const alert = [{ kind: 'token_limit' as const, taskIds: ['t'] }];
    const groups = groupProjects(
      [project('a'), project('b'), project('c', '2026-02-01')],
      byId(telemetry('a'), telemetry('b', { alerts: alert }), telemetry('c', { alerts: alert })),
    );
    expect(names(groups.alerts)).toEqual(['b']);
    expect(groupProjects([project('a')]).alerts).toEqual([]);
  });
});

describe('filterProjects', () => {
  const projects = [project('Task App'), { ...project('Otro'), workspacePath: '/srv/TASKS/web' }];

  it('matches name and workspace path ignoring case', () => {
    expect(names(filterProjects(projects, 'task'))).toEqual(['Task App', 'Otro']);
    expect(names(filterProjects(projects, ' srv/tasks '))).toEqual(['Otro']);
  });

  it('returns everything for a blank query and nothing when no match', () => {
    expect(filterProjects(projects, '  ')).toBe(projects);
    expect(filterProjects(projects, 'zzz')).toEqual([]);
  });
});

describe('sortProjects', () => {
  const projects = [project('Beta'), project('alfa'), project('Ñu'), project('Gamma')];
  const data = byId(
    telemetry('Beta', { lastActivityAt: '2026-10-01T00:00:00Z', totalTokens: 10 }),
    telemetry('alfa', { lastActivityAt: '2026-10-05T00:00:00Z', totalTokens: 500 }),
    telemetry('Gamma', { totalTokens: 500 }),
  );

  it('sorts by recent activity with nulls and unknown projects last', () => {
    expect(names(sortProjects(projects, 'recent', data))).toEqual(['alfa', 'Beta', 'Gamma', 'Ñu']);
  });

  it('sorts by name with the Spanish locale', () => {
    expect(names(sortProjects(projects, 'name', data))).toEqual(['alfa', 'Beta', 'Gamma', 'Ñu']);
  });

  it('sorts by tokens descending, ties by name, without mutating the input', () => {
    const input = [...projects];
    expect(names(sortProjects(input, 'tokens', data))).toEqual(['alfa', 'Gamma', 'Beta', 'Ñu']);
    expect(input).toEqual(projects);
  });
});

describe('weeklyDeltaLabel', () => {
  it('is sign-aware and hidden at zero', () => {
    expect(weeklyDeltaLabel(3)).toBe('+3 esta semana');
    expect(weeklyDeltaLabel(-2)).toBe('−2 esta semana');
    expect(weeklyDeltaLabel(0)).toBeNull();
  });
});

describe('swarmLabel', () => {
  const agents = ['Conde', 'Acosa', 'Lara', 'Vega', 'Arbeiza'].map((name, i) => ({ id: `a${i}`, name }));

  it('maps ids to names, skipping unknown ones', () => {
    expect(swarmLabel(['a1', 'x', 'a0'], agents)).toBe('Acosa, Conde');
    expect(swarmLabel(['x'], agents)).toBeNull();
  });

  it('caps at four names with an ellipsis', () => {
    expect(swarmLabel(['a0', 'a1', 'a2', 'a3', 'a4'], agents)).toBe('Conde, Acosa, Lara, Vega…');
  });
});
