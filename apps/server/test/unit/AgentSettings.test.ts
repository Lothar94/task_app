import { AGENT_MAX_OUTPUT_TOKENS, MAX_AGENT_MCP_SERVERS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../src/domain/agent/Agent.js';
import { ConflictError, ValidationError } from '../../src/domain/errors/DomainError.js';
import { profile } from '../support/testFleet.js';

const now = new Date('2026-10-01T00:00:00.000Z');
const later = new Date('2026-10-02T00:00:00.000Z');
const create = (overrides: Parameters<typeof profile>[1] = {}) =>
  Agent.create('a1', 'org', profile('Dev', overrides), now);

describe('Agent runtime settings', () => {
  it('defaults omitted settings to null, null and no MCP servers', () => {
    const { temperature: _t, maxOutputTokens: _m, mcpServers: _s, ...legacy } = profile('Dev');
    const snapshot = Agent.create('a1', 'org', legacy, now).toSnapshot();
    expect(snapshot).toMatchObject({
      temperature: null,
      maxOutputTokens: null,
      mcpServers: [],
      enabled: true,
    });
  });

  it('keeps temperatures within the range, bounds included', () => {
    expect(create({ temperature: 0 }).temperature).toBe(0);
    expect(create({ temperature: 0.7 }).temperature).toBe(0.7);
    expect(create({ temperature: 1 }).temperature).toBe(1);
  });

  it.each([-0.1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects the temperature %s', (temperature) => {
    expect(() => create({ temperature })).toThrow(ValidationError);
  });

  it('accepts output caps from 1 to the maximum', () => {
    expect(create({ maxOutputTokens: 1 }).maxOutputTokens).toBe(1);
    expect(create({ maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS }).maxOutputTokens).toBe(
      AGENT_MAX_OUTPUT_TOKENS,
    );
  });

  it.each([0, -5, 1.5, AGENT_MAX_OUTPUT_TOKENS + 1])('rejects the output cap %s', (maxOutputTokens) => {
    expect(() => create({ maxOutputTokens })).toThrow(ValidationError);
  });

  it('trims and dedupes MCP server names, dropping empty ones', () => {
    expect(create({ mcpServers: [' github ', 'github', '', 'my_server-2'] }).mcpServers).toEqual([
      'github',
      'my_server-2',
    ]);
  });

  it.each(['with space', 'dots.not.allowed', 'a'.repeat(65), 'mcp:colon'])(
    'rejects the MCP server name %j',
    (name) => {
      expect(() => create({ mcpServers: [name] })).toThrow(ValidationError);
    },
  );

  it(`allows at most ${MAX_AGENT_MCP_SERVERS} MCP servers`, () => {
    const names = Array.from({ length: MAX_AGENT_MCP_SERVERS + 1 }, (_, index) => `server-${index}`);
    expect(() => create({ mcpServers: names.slice(0, -1) })).not.toThrow();
    expect(() => create({ mcpServers: names })).toThrow(ValidationError);
  });

  it('replaces the settings on update, omitted ones going back to their defaults', () => {
    const agent = create({ temperature: 0.2, maxOutputTokens: 1000, mcpServers: ['github'] });
    const { temperature: _t, maxOutputTokens: _m, mcpServers: _s, ...legacy } = profile('Dev');
    agent.updateProfile(legacy, later);
    expect(agent.toSnapshot()).toMatchObject({ temperature: null, maxOutputTokens: null, mcpServers: [] });
  });

  it('does not share its MCP server list with snapshots', () => {
    const agent = create({ mcpServers: ['github'] });
    agent.toSnapshot().mcpServers.push('leak');
    expect(agent.mcpServers).toEqual(['github']);
  });
});

describe('Agent enabled state', () => {
  it('is enabled when created and can receive tasks', () => {
    const agent = create();
    expect(agent.enabled).toBe(true);
    expect(() => agent.ensureCanReceiveTasks()).not.toThrow();
  });

  it('rejects new tasks with a conflict while disabled', () => {
    const agent = create();
    agent.setEnabled(false, later);
    expect(agent.enabled).toBe(false);
    expect(agent.toSnapshot().updatedAt).toEqual(later);
    expect(() => agent.ensureCanReceiveTasks()).toThrow(ConflictError);
  });

  it('can be enabled again', () => {
    const agent = create();
    agent.setEnabled(false, later);
    agent.setEnabled(true, later);
    expect(() => agent.ensureCanReceiveTasks()).not.toThrow();
  });

  it('keeps its timestamp when the state does not change', () => {
    const agent = create();
    agent.setEnabled(true, later);
    expect(agent.toSnapshot().updatedAt).toEqual(now);
  });
});
