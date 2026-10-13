import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { DelegationGateway, DelegationOutcome } from '../../../application/ports/AgentRuntime.js';

export const FLEET_SERVER_NAME = 'fleet';
export const FLEET_TOOL_NAMES = ['list_collaborators', 'delegate_task', 'report_result'].map(
  (name) => `mcp__${FLEET_SERVER_NAME}__${name}`,
);

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const textResult = (text: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text }],
  isError,
});

async function guarded(action: () => Promise<string> | string): Promise<ToolResult> {
  try {
    return textResult(await action());
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), true);
  }
}

function describeOutcome(collaboratorName: string, outcome: DelegationOutcome): string {
  return [
    `Subtask ${outcome.subtaskId} (Task ${outcome.subtaskNumber}) assigned to "${collaboratorName}" finished with status: ${outcome.status}.`,
    'Summary:',
    outcome.summary || '(no summary provided)',
  ].join('\n');
}

/** Exposes a running agent's delegation capabilities as in-process MCP tools. */
export function createFleetToolServer(gateway: DelegationGateway) {
  return createSdkMcpServer({
    name: FLEET_SERVER_NAME,
    version: '1.0.0',
    alwaysLoad: true,
    tools: [
      tool('list_collaborators', 'List the teammates you can delegate work to in this project.', {}, () =>
        guarded(() => JSON.stringify(gateway.listCollaborators(), null, 2)),
      ),
      tool(
        'delegate_task',
        'Assign a subtask to one of your collaborators and wait until they finish. ' +
          'Returns their final summary. Call it several times in one turn to work in parallel.',
        {
          collaborator: z.string().describe('Exact name of the collaborator'),
          title: z.string().describe('Short title of the subtask'),
          instructions: z
            .string()
            .describe('Self-contained instructions: context, expected outcome and acceptance criteria'),
        },
        ({ collaborator, title, instructions }) =>
          guarded(async () =>
            describeOutcome(
              collaborator,
              await gateway.delegate({ collaboratorName: collaborator, title, instructions }),
            ),
          ),
      ),
      tool(
        'report_result',
        'Report the final summary of your task to whoever assigned it. Call it once when you are done.',
        { summary: z.string().describe('What was done, files changed and open issues') },
        ({ summary }) =>
          guarded(() => {
            gateway.reportResult(summary);
            return 'Result recorded.';
          }),
      ),
    ],
  });
}
