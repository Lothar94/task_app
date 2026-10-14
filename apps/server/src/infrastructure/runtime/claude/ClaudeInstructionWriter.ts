import { query } from '@anthropic-ai/claude-agent-sdk';
import { tmpdir } from 'node:os';
import type { AgentBrief, InstructionWriter } from '../../../application/ports/InstructionWriter.js';

const WRITER_PROMPT = `You write system instructions for AI agents that work in a team coordinated by a human project manager.
Each agent runs on Claude Code inside a project workspace and can delegate subtasks to its collaborators.

Write the instructions in second person ("You ..."), in the same language as the brief, as concise Markdown:
- Mission: what the agent is responsible for and what it is not.
- Way of working: concrete practices for its role (quality standards, Clean Code and SOLID where it applies, testing, verification).
- Collaboration: when and what to delegate to each collaborator, if any, and how to review their results.
- Deliverable: what its final report must contain.
Keep it under 300 words. Reply with the instructions only: no preamble, no closing remarks, no code fences.`;

function describeBrief(brief: AgentBrief): string {
  const collaborators = brief.collaborators.length
    ? brief.collaborators.map(({ name, role }) => `- ${name}: ${role}`).join('\n')
    : '- none (works alone)';
  return [
    `Name: ${brief.name}`,
    `Role: ${brief.role}`,
    `Description: ${brief.description || '(none)'}`,
    `Tools available: ${brief.allowedTools.join(', ') || '(none)'}`,
    `Skills: ${brief.skills.join(', ') || '(none)'}`,
    `Collaborators it can delegate to:\n${collaborators}`,
    ...(brief.guidance
      ? [`Additional requests from the project manager (follow them):\n${brief.guidance}`]
      : []),
  ].join('\n');
}

/** Drafts agent instructions with a single tool-less Claude turn, using the local Claude subscription. */
export class ClaudeInstructionWriter implements InstructionWriter {
  constructor(private readonly executablePath?: string) {}

  async write(brief: AgentBrief): Promise<string> {
    const messages = query({
      prompt: describeBrief(brief),
      options: {
        model: 'sonnet',
        effort: 'medium',
        systemPrompt: WRITER_PROMPT,
        tools: [],
        maxTurns: 1,
        persistSession: false,
        settingSources: [],
        cwd: tmpdir(),
        ...(this.executablePath ? { pathToClaudeCodeExecutable: this.executablePath } : {}),
      },
    });
    for await (const message of messages) {
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        throw new Error('Claude could not draft the instructions');
      }
      return message.result.trim();
    }
    throw new Error('Claude returned no instructions');
  }
}
