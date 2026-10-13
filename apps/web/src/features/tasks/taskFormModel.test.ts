import { TASK_LIMITS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { addTag, milestoneOrNull, parseTags, startModeOf, validateLabels } from './taskFormModel';

describe('task form model', () => {
  it('parses comma-separated tags, trimmed and unique ignoring case', () => {
    expect(parseTags(' ui, Bug ,, bug,UI ,api')).toEqual(['ui', 'Bug', 'api']);
    expect(parseTags('')).toEqual([]);
  });

  it('adds a suggestion once', () => {
    expect(addTag('ui', 'api')).toBe('ui, api');
    expect(addTag('ui, api', 'API')).toBe('ui, api');
  });

  it('validates the contract limits', () => {
    expect(validateLabels('v1', 'a, b')).toBeNull();
    expect(validateLabels('x'.repeat(TASK_LIMITS.milestoneLength + 1), '')).toMatch(/milestone/);
    expect(validateLabels('', 'x'.repeat(TASK_LIMITS.tagLength + 1))).toMatch(/tag/);
    const many = Array.from({ length: TASK_LIMITS.maxTags + 1 }, (_, i) => `t${i}`).join(',');
    expect(validateLabels('', many)).toMatch(/Máximo/);
  });

  it('turns an empty milestone into null', () => {
    expect(milestoneOrNull('  ')).toBeNull();
    expect(milestoneOrNull(' v1 ')).toBe('v1');
  });

  it('uses the submitter start mode and falls back to draft without one', () => {
    expect(startModeOf('now')).toBe('now');
    expect(startModeOf('queue')).toBe('queue');
    expect(startModeOf('draft')).toBe('draft');
    expect(startModeOf(undefined)).toBe('draft');
    expect(startModeOf('bogus')).toBe('draft');
  });
});
