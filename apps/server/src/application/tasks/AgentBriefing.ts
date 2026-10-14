import type { Agent } from '../../domain/agent/Agent.js';
import type { Task } from '../../domain/task/Task.js';
import type { CollaboratorInfo } from '../ports/AgentRuntime.js';

export interface BriefingContext {
  agent: Agent;
  instructions: string;
  collaborators: CollaboratorInfo[];
}

/** Builds the texts that tell an agent who it is, who its team is and what it must do. */
export class AgentBriefing {
  /** @param reservedPorts ports used by the Agent Fleet app, which agents must leave alone. */
  constructor(private readonly reservedPorts: readonly number[] = []) {}

  systemPromptAppendix({ agent, instructions, collaborators }: BriefingContext): string {
    return [
      this.identitySection(agent),
      `# Your instructions\n${instructions}`,
      ...this.skillsSection(agent),
      this.teamSection(collaborators),
      this.sharedMachineSection(),
      this.efficiencySection(),
      this.reportingSection(),
    ].join('\n\n');
  }

  taskPrompt(task: Task, requester: string, workspacePath: string): string {
    return [
      `# Task ${task.number}: ${task.title}`,
      `Requested by: ${requester}`,
      `Workspace: ${workspacePath}`,
      '',
      task.description,
    ].join('\n');
  }

  private identitySection(agent: Agent): string {
    const lines = [
      '# Your identity',
      `You are "${agent.name}", acting as ${agent.role} in a team of AI agents coordinated by a human project manager.`,
    ];
    if (agent.description) lines.push(agent.description);
    return lines.join('\n');
  }

  private skillsSection(agent: Agent): string[] {
    if (agent.skills.length === 0) return [];
    return [
      [
        '# Your skills',
        'You must use these skills. Load each one with the `Skill` tool before doing the work it covers:',
        ...agent.skills.map((skill) => `- ${skill}`),
      ].join('\n'),
    ];
  }

  private teamSection(collaborators: CollaboratorInfo[]): string {
    if (collaborators.length === 0) {
      return '# Your team\nYou have no collaborators available in this project: do the work yourself.';
    }
    const roster = collaborators
      .map(({ name, role, description }) => `- "${name}" — ${role}${description ? `: ${description}` : ''}`)
      .join('\n');
    return [
      '# Your team',
      'You can delegate work to these collaborators with the `delegate_task` tool:',
      roster,
      '',
      'Delegation rules:',
      '- Give each collaborator self-contained instructions: they do not see your conversation.',
      '- Call `delegate_task` several times in the same turn to run independent work in parallel.',
      '- Each call waits until the collaborator finishes and returns its summary; review it before moving on.',
      "- Delegate only what fits the collaborator's role; do the rest yourself.",
    ].join('\n');
  }

  private sharedMachineSection(): string {
    const ports = this.reservedPorts.length > 0 ? this.reservedPorts.join(', ') : 'none';
    return [
      '# Shared machine',
      'You run on the same machine as the app that coordinates you and other agents. Never stop processes you did not start:',
      '- Do not use `pkill`, `killall`, `fuser -k` or kill whatever holds a port; these commands are blocked.',
      '- When you start a server, save its PID (`cmd & echo $! > /tmp/<name>.pid`) and stop only that PID.',
      `- Ports in use by the coordinating app, never use or touch them: ${ports}. Start your servers on other free ports.`,
    ].join('\n');
  }

  private efficiencySection(): string {
    return [
      '# Working efficiently',
      '- Every turn re-reads the whole conversation: fewer turns and smaller tool outputs save the most.',
      '- Batch independent tool calls (reads, searches, commands) in a single response instead of one per turn.',
      '- Search first (Grep/Glob) and read only the relevant line ranges of large files; do not re-read files you already have.',
      '- Keep command output short: `| tail -n 40`, quiet/summary reporters, `git diff --stat` before targeted diffs.',
      '- Only view images when essential; crop or downscale screenshots first.',
    ].join('\n');
  }

  private reportingSection(): string {
    return [
      '# Finishing',
      'When you are done, call the `report_result` tool with a concise summary (max ~200 words: result, files changed, open issues).',
      'That summary enters the context of whoever assigned you the task, so keep it short.',
    ].join('\n');
  }
}
