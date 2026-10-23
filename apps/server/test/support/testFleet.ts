import type { SkillDto } from '@fleet/shared';
import type { SkillCatalog } from '../../src/application/ports/SkillCatalog.js';
import type { PluginRegistry } from '../../src/application/ports/PluginRegistry.js';
import type { PreparedSkills, SkillWorkspace } from '../../src/application/ports/SkillWorkspace.js';
import { DEFAULT_ORGANIZATION_ID } from '../../src/infrastructure/persistence/sqlite/migrations.js';
import type { AgentProfile } from '../../src/domain/agent/Agent.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/openDatabase.js';
import type { AgentBrief, InstructionWriter } from '../../src/application/ports/InstructionWriter.js';
import { type ContainerOptions, createContainer } from '../../src/main/container.js';
import { type AgentBehaviour, FakeAgentRuntime } from './FakeAgentRuntime.js';
import { FakeGitWorkspace } from './FakeGitWorkspace.js';

export class FakeInstructionWriter implements InstructionWriter {
  readonly briefs: AgentBrief[] = [];

  async write(brief: AgentBrief): Promise<string> {
    this.briefs.push(brief);
    return `Generated instructions for ${brief.name}${brief.guidance ? ` (${brief.guidance})` : ''}`;
  }
}

export const TEST_APP_VERSION = '1.2.3-test';

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

export function profile(name: string, overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    name,
    role: `${name} role`,
    description: '',
    instructions: `Act as ${name}`,
    model: 'sonnet',
    effort: 'high',
    modelSelection: 'fixed',
    allowedTools: ['Read'],
    skills: [],
    permissionMode: 'dontAsk',
    maxTurns: 10,
    temperature: null,
    maxOutputTokens: null,
    mcpServers: [],
    ...overrides,
  };
}

export const noPlugins: PluginRegistry = { list: async () => [] };

export class FakeSkillCatalog implements SkillCatalog {
  constructor(readonly skills: SkillDto[] = []) {}

  async list(): Promise<SkillDto[]> {
    return this.skills;
  }
}

/** Records the preparations and returns a fake bridge directory for agents with skills. */
export class FakeSkillWorkspace implements SkillWorkspace {
  readonly prepared: (readonly string[])[] = [];

  async prepare(skills: readonly string[]): Promise<PreparedSkills> {
    this.prepared.push(skills);
    return {
      skillsDirectory: skills.length > 0 ? `/tmp/skill-bridges/${[...skills].sort().join('+')}` : null,
      pluginPaths: [],
    };
  }
}

export function fakeSkillSupport(skills: SkillDto[] = []) {
  return { skillCatalog: new FakeSkillCatalog(skills), skillWorkspace: new FakeSkillWorkspace() };
}

export function createTestFleet(
  behaviours: Record<string, AgentBehaviour> = {},
  maxDelegationDepth = 4,
  reservedPorts: number[] = [],
  catalogSkills: SkillDto[] = [],
  extraOptions: Pick<
    ContainerOptions,
    'mcpServerCatalog' | 'monthlyBudgetUsd' | 'agentActivityCoalesceMs'
  > = {},
) {
  const runtime = new FakeAgentRuntime(behaviours);
  const instructionWriter = new FakeInstructionWriter();
  const skillSupport = fakeSkillSupport(catalogSkills);
  const git = new FakeGitWorkspace();
  const container = createContainer({
    db: openDatabase(':memory:'),
    runtime,
    instructionWriter,
    ...skillSupport,
    logger: silentLogger,
    git,
    maxDelegationDepth,
    appVersion: TEST_APP_VERSION,
    reservedPorts,
    ...extraOptions,
  });
  return { runtime, git, instructionWriter, skillWorkspace: skillSupport.skillWorkspace, ...container };
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
