import type { McpServerDto } from '@fleet/shared';

/** The MCP servers configured for the user, which agents can be given by name. */
export interface McpServerCatalog {
  /** Only names and transports; never throws for a missing or invalid config: returns an empty list. */
  list(): Promise<McpServerDto[]>;
}
