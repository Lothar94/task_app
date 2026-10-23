import { dirname, join } from 'node:path';
import { createHttpServer } from '../interfaces/http/createHttpServer.js';
import { openDatabase } from '../infrastructure/persistence/sqlite/openDatabase.js';
import { ClaudeInstructionWriter } from '../infrastructure/runtime/claude/ClaudeInstructionWriter.js';
import { ClaudeAgentRuntime } from '../infrastructure/runtime/claude/ClaudeAgentRuntime.js';
import { ClaudeUserMcpServers } from '../infrastructure/runtime/claude/ClaudeUserMcpServers.js';
import { SdkMessageMapper } from '../infrastructure/runtime/claude/SdkMessageMapper.js';
import { ClaudeOAuthPlanUsageSource } from '../infrastructure/system/ClaudeOAuthPlanUsageSource.js';
import { ClaudePluginRegistry } from '../infrastructure/system/ClaudePluginRegistry.js';
import { FileSystemSkillCatalog } from '../infrastructure/system/FileSystemSkillCatalog.js';
import { FileSystemSkillWorkspace } from '../infrastructure/system/FileSystemSkillWorkspace.js';
import { ConsoleLogger } from '../infrastructure/system/ConsoleLogger.js';
import { SystemClock } from '../infrastructure/system/SystemClock.js';
import { claudeRuntimeConfig } from './claudeRuntimeConfig.js';
import { loadConfig } from './config.js';
import { createContainer } from './container.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new ConsoleLogger();
  if (process.env.ANTHROPIC_API_KEY) {
    logger.info(
      'ANTHROPIC_API_KEY is set: agents will bill the API key instead of your Claude subscription.',
    );
  }

  const plugins = new ClaudePluginRegistry(config.claudeConfigDir);
  const mcpServers = new ClaudeUserMcpServers(config.claudeUserConfigFile, logger);
  const container = createContainer({
    db: openDatabase(config.databasePath),
    runtime: new ClaudeAgentRuntime(new SdkMessageMapper(), mcpServers, logger, claudeRuntimeConfig(config)),
    instructionWriter: new ClaudeInstructionWriter(config.claudeExecutablePath),
    skillCatalog: new FileSystemSkillCatalog(config.userSkillsDir, plugins),
    skillWorkspace: new FileSystemSkillWorkspace(
      config.userSkillsDir,
      join(dirname(config.databasePath), 'skill-bridges'),
      plugins,
    ),
    logger,
    planUsageSource: new ClaudeOAuthPlanUsageSource(
      join(config.claudeConfigDir, '.credentials.json'),
      new SystemClock(),
    ),
    maxDelegationDepth: config.maxDelegationDepth,
    appVersion: config.appVersion,
    reservedPorts: config.reservedPorts,
    modelPrices: config.modelPrices,
    mcpServerCatalog: mcpServers,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
  });

  const recovered = container.recoverInterruptedTasks.execute();
  if (recovered > 0) logger.info(`Marked ${recovered} interrupted task(s) as failed`);
  container.processTaskQueues();

  const app = await createHttpServer({
    useCases: container.useCases,
    events: container.events,
    logger,
    allowedOrigin: config.allowedOrigin,
  });
  await app.listen({ port: config.port, host: config.host });
  logger.info(`API listening on http://${config.host}:${config.port} (database: ${config.databasePath})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
