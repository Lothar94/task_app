import { DEFAULT_AGENT_TOOLS } from '@fleet/shared';
import type { AgentProfile } from '../domain/agent/Agent.js';
import { openDatabase } from '../infrastructure/persistence/sqlite/openDatabase.js';
import { ClaudeInstructionWriter } from '../infrastructure/runtime/claude/ClaudeInstructionWriter.js';
import { ClaudeAgentRuntime } from '../infrastructure/runtime/claude/ClaudeAgentRuntime.js';
import { SdkMessageMapper } from '../infrastructure/runtime/claude/SdkMessageMapper.js';
import { ConsoleLogger } from '../infrastructure/system/ConsoleLogger.js';
import { claudeRuntimeConfig } from './claudeRuntimeConfig.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';

const TEAM: AgentProfile[] = [
  {
    name: 'CTO',
    role: 'Chief Technology Officer',
    description: 'Breaks work down, decides the architecture and coordinates the team.',
    instructions: [
      'Analyse the request, decide the technical approach and split it into subtasks.',
      'Delegate each subtask to the most suitable collaborator with precise acceptance criteria.',
      'Run independent subtasks in parallel. Review every result and ask for fixes when needed.',
      'Only write code yourself for glue work or when no collaborator fits.',
    ].join('\n'),
    model: 'opus',
    effort: 'high',
    allowedTools: ['Read', 'Glob', 'Grep', 'TodoWrite'],
    permissionMode: 'dontAsk',
    maxTurns: 60,
  },
  {
    name: 'Backend',
    role: 'Backend engineer',
    description: 'APIs, persistence, business logic and server-side tests.',
    instructions:
      'Implement server-side code following Clean Code and SOLID. Add tests and run them before reporting.',
    model: 'sonnet',
    effort: 'medium',
    allowedTools: DEFAULT_AGENT_TOOLS,
    permissionMode: 'dontAsk',
    maxTurns: 80,
  },
  {
    name: 'Frontend',
    role: 'Frontend engineer',
    description: 'User interfaces, accessibility and client-side state.',
    instructions:
      'Implement accessible, responsive UIs following Clean Code. Keep components small and focused.',
    model: 'sonnet',
    effort: 'medium',
    allowedTools: DEFAULT_AGENT_TOOLS,
    permissionMode: 'dontAsk',
    maxTurns: 80,
  },
  {
    name: 'QA',
    role: 'QA engineer',
    description: 'Verifies behaviour against acceptance criteria and reports defects.',
    instructions:
      'Review and test the delivered work. Report defects with reproduction steps; do not fix them yourself.',
    model: 'sonnet',
    effort: 'low',
    allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
    permissionMode: 'dontAsk',
    maxTurns: 40,
  },
];

const config = loadConfig();
const logger = new ConsoleLogger();
const { useCases } = createContainer({
  db: openDatabase(config.databasePath),
  runtime: new ClaudeAgentRuntime(new SdkMessageMapper(), claudeRuntimeConfig(config)),
  instructionWriter: new ClaudeInstructionWriter(config.claudeExecutablePath),
  logger,
  maxDelegationDepth: config.maxDelegationDepth,
});

const existing = new Set(useCases.listAgents.execute().map((agent) => agent.name.toLowerCase()));
const created = await Promise.all(
  TEAM.filter((profile) => !existing.has(profile.name.toLowerCase())).map((profile) =>
    useCases.createAgent.execute({ profile, collaboratorIds: [] }),
  ),
);

const byName = new Map(useCases.listAgents.execute().map((agent) => [agent.name, agent]));
const cto = byName.get('CTO');
if (cto) {
  const team = ['Backend', 'Frontend', 'QA'].flatMap((name) => byName.get(name)?.id ?? []);
  useCases.setAgentCollaborators.execute(cto.id, [...new Set([...cto.collaboratorIds, ...team])]);
}
logger.info(`Seed complete: ${created.length} agent(s) created`);
