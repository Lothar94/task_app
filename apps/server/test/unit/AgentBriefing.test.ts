import { describe, expect, it } from 'vitest';
import { AgentBriefing } from '../../src/application/tasks/AgentBriefing.js';
import { Agent } from '../../src/domain/agent/Agent.js';
import { profile } from '../support/testFleet.js';

const agent = Agent.create('a1', profile('Lara'), new Date());
const context = { agent, instructions: 'Do the work.', collaborators: [] };

describe('AgentBriefing.systemPromptAppendix', () => {
  const appendix = new AgentBriefing([4100]).systemPromptAppendix(context);

  it('includes the efficiency section before Finishing', () => {
    const efficiency = appendix.indexOf('# Working efficiently');
    expect(efficiency).toBeGreaterThan(-1);
    expect(efficiency).toBeLessThan(appendix.indexOf('# Finishing'));
  });

  it('keeps the efficiency section compact', () => {
    const section = appendix.slice(appendix.indexOf('# Working efficiently'), appendix.indexOf('# Finishing'));
    expect(section.split('\n').filter((line) => line.startsWith('- ')).length).toBeLessThanOrEqual(8);
  });

  it('asks for a concise report_result summary', () => {
    const finishing = appendix.slice(appendix.indexOf('# Finishing'));
    expect(finishing).toContain('max ~200 words');
  });

  it('is deterministic for the same input', () => {
    expect(new AgentBriefing([4100]).systemPromptAppendix(context)).toBe(appendix);
  });
});
