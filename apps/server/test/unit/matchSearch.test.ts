import { SEARCH_LIMITS, type TaskStatus } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { matchSearch, normalizeText, parseTaskNumber, type SearchCorpus } from '../../src/application/search/matchSearch.js';

const at = (day: number) => new Date(Date.UTC(2026, 0, day));

const project = (id: string, name: string, day = 1) => ({
  hit: { id, name, archived: false },
  createdAt: at(day),
});

const task = (id: string, number: number, title: string, day = 1, projectId = 'p1') => ({
  hit: { id, number, title, status: 'completed' as TaskStatus, projectId, projectName: projectId },
  createdAt: at(day),
});

const agent = (id: string, name: string, role: string, day = 1) => ({
  hit: { id, name, role },
  createdAt: at(day),
});

const corpus = (parts: Partial<SearchCorpus>): SearchCorpus => ({
  projects: [],
  tasks: [],
  agents: [],
  ...parts,
});

const ids = (hits: { id: string }[]) => hits.map((hit) => hit.id);

describe('normalizeText', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeText('Diseño ÁÉÍÓÚ Café')).toBe('diseno aeiou cafe');
  });
});

describe('parseTaskNumber', () => {
  it.each([
    ['61', 61],
    ['#61', 61],
    ['tarea 61', 61],
    ['TASK 61', 61],
    ['  Tarea   7 ', 7],
  ])('reads %j as task number %d', (query, expected) => {
    expect(parseTaskNumber(query)).toBe(expected);
  });

  it.each(['', 'abc', '61a', 'tarea', 'tarea x', '# 61', 'tasks 61', '6 1'])('ignores %j', (query) => {
    expect(parseTaskNumber(query)).toBeNull();
  });
});

describe('matchSearch', () => {
  it('answers empty groups, echoing the trimmed query, for an empty or blank query', () => {
    const data = corpus({ projects: [project('p', 'Alpha')] });
    expect(matchSearch(data, '')).toEqual({ query: '', projects: [], tasks: [], agents: [] });
    expect(matchSearch(data, '   ')).toEqual({ query: '', projects: [], tasks: [], agents: [] });
  });

  it('trims the query it echoes', () => {
    expect(matchSearch(corpus({}), '  alpha ').query).toBe('alpha');
  });

  it('matches case- and accent-insensitively in both directions', () => {
    const data = corpus({
      projects: [project('p1', 'Diseño Café')],
      tasks: [task('t1', 1, 'Revisión de ACCESIBILIDAD')],
      agents: [agent('a1', 'Ana', 'Ingeniera de Operación')],
    });
    expect(ids(matchSearch(data, 'DISENO cafe').projects)).toEqual(['p1']);
    expect(ids(matchSearch(data, 'revision').tasks)).toEqual(['t1']);
    expect(ids(matchSearch(data, 'accesibilidád').tasks)).toEqual(['t1']);
    expect(ids(matchSearch(data, 'operacion').agents)).toEqual(['a1']);
  });

  it('matches agents by name or role', () => {
    const data = corpus({ agents: [agent('a1', 'Lara', 'Backend'), agent('a2', 'Mia', 'Designer')] });
    expect(ids(matchSearch(data, 'lara').agents)).toEqual(['a1']);
    expect(ids(matchSearch(data, 'design').agents)).toEqual(['a2']);
  });

  it('does not search task titles in projects or agents', () => {
    const data = corpus({ projects: [project('p1', 'Alpha')], tasks: [task('t1', 1, 'Alpha work')] });
    const result = matchSearch(data, 'work');
    expect(result.projects).toEqual([]);
    expect(ids(result.tasks)).toEqual(['t1']);
  });

  it('ranks exact, then prefix, then contains, regardless of recency', () => {
    const data = corpus({
      projects: [
        project('contains', 'The api gateway', 5),
        project('prefix', 'API gateway', 4),
        project('exact', 'api', 1),
      ],
    });
    expect(ids(matchSearch(data, 'API').projects)).toEqual(['exact', 'prefix', 'contains']);
  });

  it('breaks ties with the most recent first', () => {
    const data = corpus({
      tasks: [task('old', 1, 'Fix bug', 1), task('new', 2, 'Fix bug', 3), task('mid', 3, 'Fix bug', 2)],
    });
    expect(ids(matchSearch(data, 'fix').tasks)).toEqual(['new', 'mid', 'old']);
  });

  it('ranks agents by their best field', () => {
    const data = corpus({
      agents: [agent('byRole', 'Zed', 'Backend engineer', 3), agent('byName', 'Backend', 'Lead', 1)],
    });
    expect(ids(matchSearch(data, 'backend').agents)).toEqual(['byName', 'byRole']);
  });

  describe.each(['61', '#61', 'tarea 61', 'task 61', 'TAREA 61'])('numeric query %j', (query) => {
    it('matches tasks by number in any project and ranks them first', () => {
      const data = corpus({
        tasks: [
          task('title', 1, 'Fix issue 61 in billing', 9),
          task('first', 61, 'Unrelated', 1, 'p1'),
          task('second', 61, 'Other', 2, 'p2'),
          task('nope', 62, 'Unrelated', 3),
        ],
      });
      const found = ids(matchSearch(data, query).tasks);
      expect(found.slice(0, 2)).toEqual(['second', 'first']);
      expect(found).not.toContain('nope');
    });
  });

  it('matches a plain number inside titles too, after the number matches', () => {
    const data = corpus({ tasks: [task('title', 1, 'Fix issue 61', 9), task('num', 61, 'Other', 1)] });
    expect(ids(matchSearch(data, '61').tasks)).toEqual(['num', 'title']);
  });

  it('caps every group by the limit, keeping the best hits', () => {
    const data = corpus({
      projects: [project('c', 'x Beta', 3), project('b', 'Beta x', 2), project('a', 'Beta', 1)],
      tasks: [task('t1', 1, 'beta', 1), task('t2', 2, 'beta', 2), task('t3', 3, 'beta', 3)],
      agents: [agent('a1', 'Beta', 'r', 1), agent('a2', 'Beta', 'r', 2)],
    });
    const result = matchSearch(data, 'beta', 2);
    expect(ids(result.projects)).toEqual(['a', 'b']);
    expect(ids(result.tasks)).toEqual(['t3', 't2']);
    expect(ids(result.agents)).toEqual(['a2', 'a1']);
  });

  it('uses the default per-group limit', () => {
    const tasks = Array.from({ length: SEARCH_LIMITS.defaultPerGroup + 3 }, (_, i) =>
      task(`t${i}`, i + 1, 'same', i + 1),
    );
    expect(matchSearch(corpus({ tasks }), 'same').tasks).toHaveLength(SEARCH_LIMITS.defaultPerGroup);
  });

  it('returns empty groups when nothing matches', () => {
    const data = corpus({ projects: [project('p', 'Alpha')] });
    expect(matchSearch(data, 'zzz')).toEqual({ query: 'zzz', projects: [], tasks: [], agents: [] });
  });
});
