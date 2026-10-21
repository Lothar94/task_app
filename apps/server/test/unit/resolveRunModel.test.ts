import { describe, expect, it } from 'vitest';
import { resolveRunModel } from '../../src/application/tasks/resolveRunModel.js';

const agent = { model: 'sonnet', effort: 'medium' } as const;
const none = { model: null, effort: null };

describe('resolveRunModel', () => {
  it('always uses the agent settings when selection is fixed', () => {
    const choice = { model: 'opus', effort: 'xhigh' } as const;
    expect(resolveRunModel({ ...agent, modelSelection: 'fixed' }, choice)).toEqual(agent);
  });

  it('uses the full choice for auto agents', () => {
    const choice = { model: 'haiku', effort: 'low' } as const;
    expect(resolveRunModel({ ...agent, modelSelection: 'auto' }, choice)).toEqual(choice);
  });

  it('falls back to agent defaults without a choice', () => {
    expect(resolveRunModel({ ...agent, modelSelection: 'auto' }, none)).toEqual(agent);
  });

  it('mixes a partial choice with agent defaults', () => {
    expect(resolveRunModel({ ...agent, modelSelection: 'auto' }, { model: null, effort: 'high' })).toEqual({
      model: 'sonnet',
      effort: 'high',
    });
  });
});
