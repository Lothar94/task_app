import type { SearchResultsDto } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import {
  buildSearchGroups,
  isSearchShortcut,
  moveActiveIndex,
  resultCountLabel,
  shortcutLabel,
} from './searchModel';

const results: SearchResultsDto = {
  query: 've',
  projects: [{ id: 'p1', name: 'Vega', archived: false }],
  tasks: [],
  agents: [{ id: 'a1', name: 'Vera', role: 'QA' }],
};

const key = (overrides: Partial<KeyboardEvent>) =>
  ({ key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides }) as KeyboardEvent;

describe('buildSearchGroups', () => {
  it('keeps non-empty groups in order with the route of each hit', () => {
    const groups = buildSearchGroups({
      ...results,
      tasks: [{ id: 't1', number: 7, title: 'Ver', status: 'running', projectId: 'p1', projectName: 'Vega' }],
    });
    expect(groups.map((group) => group.label)).toEqual(['Proyectos', 'Tareas', 'Agentes']);
    expect(groups.flatMap((group) => group.options.map((option) => option.href))).toEqual([
      '/projects/p1',
      '/projects/p1/tasks/t1',
      '/agents/a1',
    ]);
  });

  it('drops empty groups and answers nothing without results', () => {
    expect(buildSearchGroups(results).map((group) => group.kind)).toEqual(['project', 'agent']);
    expect(buildSearchGroups(undefined)).toEqual([]);
  });
});

describe('moveActiveIndex', () => {
  it('wraps arrows around both ends', () => {
    expect(moveActiveIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(moveActiveIndex(0, 3, 'ArrowUp')).toBe(2);
    expect(moveActiveIndex(0, 3, 'ArrowDown')).toBe(1);
  });

  it('jumps with Home/End and answers -1 without options', () => {
    expect(moveActiveIndex(1, 3, 'Home')).toBe(0);
    expect(moveActiveIndex(1, 3, 'End')).toBe(2);
    expect(moveActiveIndex(0, 0, 'ArrowDown')).toBe(-1);
  });
});

describe('search shortcut', () => {
  it('accepts ⌘K and Ctrl+K but not other combinations', () => {
    expect(isSearchShortcut(key({ metaKey: true }))).toBe(true);
    expect(isSearchShortcut(key({ ctrlKey: true, key: 'K' }))).toBe(true);
    expect(isSearchShortcut(key({}))).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, key: 'j' }))).toBe(false);
  });

  it('labels the shortcut by platform', () => {
    expect(shortcutLabel('MacIntel')).toBe('⌘K');
    expect(shortcutLabel('macOS')).toBe('⌘K');
    expect(shortcutLabel('Linux x86_64')).toBe('Ctrl K');
  });
});

describe('resultCountLabel', () => {
  it('pluralises and names the empty state', () => {
    expect(resultCountLabel(0)).toBe('Sin resultados');
    expect(resultCountLabel(1)).toBe('1 resultado');
    expect(resultCountLabel(4)).toBe('4 resultados');
  });
});
