// @vitest-environment jsdom
import type { SearchResultsDto } from '@fleet/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSearchGroups, currentPlatform, isSearchShortcut, moveActiveIndex, resultCountLabel, shortcutLabel } from './searchModel';

const key = (overrides: Partial<KeyboardEvent>) =>
  ({ key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides }) as KeyboardEvent;

const setPlatform = (value: string) => Object.defineProperty(navigator, 'platform', { value, configurable: true });

afterEach(() => {
  Reflect.deleteProperty(navigator, 'platform');
  Reflect.deleteProperty(navigator, 'userAgentData');
});

describe('search model QA', () => {
  it.each([
    ['MacIntel', '⌘K'],
    ['MacPPC', '⌘K'],
    ['iPhone', '⌘K'],
    ['iPad', '⌘K'],
    ['Win32', 'Ctrl K'],
    ['Linux x86_64', 'Ctrl K'],
    ['', 'Ctrl K'],
  ])('labels the shortcut for platform %j as %s', (platform, label) => {
    expect(shortcutLabel(platform)).toBe(label);
  });

  it('reads the platform from userAgentData first, then navigator.platform', () => {
    setPlatform('Win32');
    expect(shortcutLabel(currentPlatform())).toBe('Ctrl K');
    Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true });
    expect(currentPlatform()).toBe('macOS');
    expect(shortcutLabel(currentPlatform())).toBe('⌘K');
  });

  it.each([
    ['⌘K', { metaKey: true }, true],
    ['Ctrl+K', { ctrlKey: true }, true],
    ['Ctrl+Shift+K (uppercase K)', { ctrlKey: true, shiftKey: true, key: 'K' }, false],
    ['Caps-lock Ctrl+K', { ctrlKey: true, key: 'K' }, true],
    ['Ctrl+Alt+K', { ctrlKey: true, altKey: true }, false],
    ['plain k', {}, false],
    ['Ctrl+J', { ctrlKey: true, key: 'j' }, false],
    ['⌘+Ctrl+K', { metaKey: true, ctrlKey: true }, true],
  ])('shortcut %s → %s', (_name, patch, expected) => {
    expect(isSearchShortcut(key(patch))).toBe(expected);
  });

  it('moves the active index at the boundaries', () => {
    expect(moveActiveIndex(-1, 0, 'ArrowDown')).toBe(-1);
    expect(moveActiveIndex(-1, 0, 'End')).toBe(-1);
    expect(moveActiveIndex(0, 1, 'ArrowDown')).toBe(0);
    expect(moveActiveIndex(0, 1, 'ArrowUp')).toBe(0);
    expect(moveActiveIndex(0, 3, 'ArrowUp')).toBe(2);
    expect(moveActiveIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(moveActiveIndex(1, 3, 'Home')).toBe(0);
    expect(moveActiveIndex(1, 3, 'End')).toBe(2);
  });

  it('builds hrefs of the three kinds, dropping empty groups and keeping the server order', () => {
    const results: SearchResultsDto = {
      query: 'x',
      projects: [],
      tasks: [
        { id: 't2', number: 2, title: 'B', status: 'queued', projectId: 'p1', projectName: 'P' },
        { id: 't1', number: 1, title: 'A', status: 'queued', projectId: 'p1', projectName: 'P' },
      ],
      agents: [{ id: 'a1', name: 'N', role: 'R' }],
    };
    const groups = buildSearchGroups(results);
    expect(groups.map((group) => group.label)).toEqual(['Tareas', 'Agentes']);
    expect(groups[0]?.options.map((option) => option.href)).toEqual(['/projects/p1/tasks/t2', '/projects/p1/tasks/t1']);
    expect(groups[1]?.options[0]?.href).toBe('/agents/a1');
    expect(buildSearchGroups(undefined)).toEqual([]);
  });

  it('pluralises the result count', () => {
    expect([0, 1, 2].map(resultCountLabel)).toEqual(['Sin resultados', '1 resultado', '2 resultados']);
  });
});
