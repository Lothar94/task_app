import { describe, expect, it } from 'vitest';
import {
  isSheetDirty,
  maxOutputTokensError,
  mcpOptions,
  sheetValuesOf,
  splitValidationDetails,
  toggleItem,
  toolOptions,
  toSheetAgentInput,
} from './agentSheetForm';
import { agentFixture } from './agentTestData';

const agent = agentFixture({
  allowedTools: ['Read', 'WebFetch'],
  mcpServers: ['github', 'legacy'],
  temperature: 0.4,
});

describe('agent sheet form', () => {
  it('is dirty only when a value differs, ignoring list order', () => {
    const values = sheetValuesOf(agent);
    expect(isSheetDirty(agent, values)).toBe(false);
    expect(isSheetDirty(agent, { ...values, mcpServers: ['legacy', 'github'] })).toBe(false);
    expect(isSheetDirty(agent, { ...values, instructions: 'Otra' })).toBe(true);
    expect(isSheetDirty(agent, { ...values, temperature: null })).toBe(true);
  });

  it('builds the full AgentInput, nulling settings the runtime does not support', () => {
    const values = { ...sheetValuesOf(agent), model: 'opus' as const, maxOutputTokens: '8192' };
    const input = toSheetAgentInput(agent, values, { temperature: true, maxOutputTokens: false });
    expect(input).toEqual({
      name: 'Ada',
      role: 'Backend',
      description: '',
      instructions: 'Escribe código.',
      model: 'opus',
      effort: 'high',
      modelSelection: 'fixed',
      allowedTools: ['Read', 'WebFetch'],
      skills: [],
      permissionMode: 'dontAsk',
      maxTurns: 50,
      temperature: 0.4,
      maxOutputTokens: null,
      mcpServers: ['github', 'legacy'],
    });
    expect(
      toSheetAgentInput(agent, values, { temperature: true, maxOutputTokens: true }).maxOutputTokens,
    ).toBe(8192);
  });

  it('validates max output tokens', () => {
    expect(maxOutputTokensError('')).toBeNull();
    expect(maxOutputTokensError('4096')).toBeNull();
    expect(maxOutputTokensError('0')).not.toBeNull();
    expect(maxOutputTokensError('1.5')).not.toBeNull();
    expect(maxOutputTokensError('999999')).toMatch(/128/);
  });

  it('offers the default tools plus the agent ones and flags MCP servers missing from the catalog', () => {
    expect(toolOptions(agent)).toEqual([
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'Bash',
      'TodoWrite',
      'WebFetch',
    ]);
    const runtime = {
      supports: { temperature: true, maxOutputTokens: true },
      mcpServers: [{ name: 'github', transport: 'stdio' as const }],
    };
    expect(mcpOptions(agent, runtime)).toEqual([
      { name: 'github', available: true },
      { name: 'legacy', available: false },
    ]);
  });

  it('toggles items keeping the options order', () => {
    expect(toggleItem(['Bash'], 'Read', ['Read', 'Bash'])).toEqual(['Read', 'Bash']);
    expect(toggleItem(['Read', 'Bash'], 'Read', ['Read', 'Bash'])).toEqual(['Bash']);
  });

  it('splits server validation details into sheet fields and the rest', () => {
    expect(
      splitValidationDetails(['temperature: too high', 'mcpServers.1: unknown', 'name: required']),
    ).toEqual({
      byField: { temperature: 'too high', mcpServers: 'unknown' },
      general: ['name: required'],
    });
  });
});
