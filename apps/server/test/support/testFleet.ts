import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import type { AgentProfile } from '../../src/domain/agent/Agent.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import type { AgentBrief, InstructionWriter } from '../../src/application/ports/InstructionWriter.js';
import { createContainer } from '../../src/main/container.js';
import { type AgentBehaviour, FakeAgentRuntime } from './FakeAgentRuntime.js';

export class FakeInstructionWriter implements InstructionWriter {
  readonly briefs: AgentBrief[] = [];

  async write(brief: AgentBrief): Promise<string> {
    this.briefs.push(brief);
    return `Generated instructions for ${brief.name}${brief.guidance ? ` (${brief.guidance})` : ''}`;
  }
}

const silentLogger = { info: () => undefined, error: () => undefined };

export function profile(name: string, overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    name,
    role: `${name} role`,
    description: '',
    instructions: `Act as ${name}`,
    model: 'sonnet',
    effort: 'high',
    allowedTools: ['Read'],
    permissionMode: 'dontAsk',
    maxTurns: 10,
    ...overrides,
  };
}

export function createTestFleet(
  behaviours: Record<string, AgentBehaviour> = {},
  maxDelegationDepth = 4,
  reservedPorts: number[] = [],
) {
  const runtime = new FakeAgentRuntime(behaviours);
  const instructionWriter = new FakeInstructionWriter();
  const container = createContainer({
    db: openDatabase(':memory:'),
    runtime,
    instructionWriter,
    logger: silentLogger,
    maxDelegationDepth,
    reservedPorts,
  });
  return { runtime, instructionWriter, ...container };
}

/** Creates a CTO that can delegate to the given teammates, all members of a fresh project. */
export async function createTeamProject(
  fleet: ReturnType<typeof createTestFleet>,
  teammates: string[],
  organizationId = DEFAULT_ORGANIZATION_ID,
) {
  const { useCases } = fleet;
  const members = await Promise.all(
    teammates.map((name) =>
      useCases.createAgent.execute({ organizationId, profile: profile(name), collaboratorIds: [] }),
    ),
  );
  const cto = await useCases.createAgent.execute({
    organizationId,
    profile: profile('CTO'),
    collaboratorIds: members.map((member) => member.id),
  });
  const project = useCases.createProject.execute({
    organizationId,
    details: { name: 'Demo', description: '', workspacePath: '/tmp/fleet-test-workspace' },
    memberIds: [cto.id, ...members.map((member) => member.id)],
  });
  return { cto, members, project };
}

export async function eventually(assertion: () => void | Promise<void>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
