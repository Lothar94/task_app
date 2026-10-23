import type { AgentRuntimeInfoDto } from '@fleet/shared';
import type { RuntimeCapabilities } from '../ports/AgentRuntime.js';
import type { McpServerCatalog } from '../ports/McpServerCatalog.js';

/** What the agent sheet can edit: the settings the runtime honours and the MCP servers available. */
export class GetAgentRuntimeInfo {
  constructor(
    private readonly runtime: RuntimeCapabilities,
    private readonly mcpServers: McpServerCatalog,
  ) {}

  async execute(): Promise<AgentRuntimeInfoDto> {
    return { supports: { ...this.runtime.supports }, mcpServers: await this.mcpServers.list() };
  }
}
