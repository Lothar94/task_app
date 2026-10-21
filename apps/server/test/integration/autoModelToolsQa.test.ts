import { AGENT_MODELS, EFFORT_LEVELS } from '@fleet/shared';
import { describe, expect, it } from 'vitest';
import type { DelegationGateway, DelegationRequest } from '../../src/application/ports/AgentRuntime.js';
import { createFleetToolServer } from '../../src/infrastructure/runtime/claude/FleetToolServer.js';

type Tool = {
  description: string;
  inputSchema: { shape: Record<string, { isOptional(): boolean; options?: string[]; description?: string; safeParse(v: unknown): { success: boolean } }> };
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
};

const tools = (gateway: Partial<DelegationGateway>) =>
  (createFleetToolServer(gateway as DelegationGateway) as unknown as { instance: { _registeredTools: Record<string, Tool> } })
    .instance._registeredTools;

describe('delegate_task MCP schema (QA)', () => {
  const shape = tools({}).delegate_task!.inputSchema.shape;

  it('keeps collaborator, title and instructions required', () => {
    for (const key of ['collaborator', 'title', 'instructions']) expect(shape[key]!.isOptional()).toBe(false);
  });

  it('exposes model and effort as optional enums matching the shared lists', () => {
    expect(shape.model!.isOptional()).toBe(true);
    expect(shape.effort!.isOptional()).toBe(true);
    for (const value of AGENT_MODELS) expect(shape.model!.safeParse(value).success).toBe(true);
    for (const value of EFFORT_LEVELS) expect(shape.effort!.safeParse(value).success).toBe(true);
    expect(shape.model!.safeParse('gpt-4').success).toBe(false);
    expect(shape.effort!.safeParse('ultra').success).toBe(false);
  });

  it('mentions automatic selection in the parameter descriptions', () => {
    expect(shape.model!.description).toMatch(/automatic model selection/);
    expect(shape.effort!.description).toMatch(/automatic model selection/);
  });

  it('forwards model and effort to the gateway and reports the model used', async () => {
    let received: DelegationRequest | undefined;
    const gateway = {
      delegate: async (request: DelegationRequest) => {
        received = request;
        return { subtaskId: 's1', subtaskNumber: 2, status: 'completed', summary: 'ok', model: 'opus', effort: 'max' };
      },
    };
    const result = await tools(gateway as unknown as DelegationGateway).delegate_task!.handler(
      { collaborator: 'Dev', title: 't', instructions: 'i', model: 'opus', effort: 'max' },
      {},
    );
    expect(received).toMatchObject({ collaboratorName: 'Dev', model: 'opus', effort: 'max' });
    expect(result.content[0]!.text).toContain('Ran with model opus, effort max.');
  });

  it('omits model and effort when the agent does not pass them', async () => {
    let received: DelegationRequest | undefined;
    const gateway = {
      delegate: async (request: DelegationRequest) => {
        received = request;
        return { subtaskId: 's1', subtaskNumber: 2, status: 'completed', summary: '', model: 'sonnet', effort: 'high' };
      },
    };
    await tools(gateway as unknown as DelegationGateway).delegate_task!.handler(
      { collaborator: 'Dev', title: 't', instructions: 'i' },
      {},
    );
    expect(received?.model).toBeUndefined();
    expect(received?.effort).toBeUndefined();
  });

  it('turns a gateway rejection into an error result', async () => {
    const gateway = { delegate: async () => { throw new Error('Invalid model "x"'); } };
    const result = await tools(gateway as unknown as DelegationGateway).delegate_task!.handler(
      { collaborator: 'Dev', title: 't', instructions: 'i', model: 'opus' },
      {},
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Invalid model');
  });
});

describe('list_collaborators MCP tool (QA)', () => {
  it('returns modelSelection for every collaborator as JSON', async () => {
    const gateway = {
      listCollaborators: () => [
        { name: 'A', role: 'r', description: '', modelSelection: 'auto' },
        { name: 'B', role: 'r', description: '', modelSelection: 'fixed' },
      ],
    };
    const result = await tools(gateway as unknown as DelegationGateway).list_collaborators!.handler({}, {});
    const parsed = JSON.parse(result.content[0]!.text) as { name: string; modelSelection: string }[];
    expect(parsed.map((c) => [c.name, c.modelSelection])).toEqual([['A', 'auto'], ['B', 'fixed']]);
  });
});
