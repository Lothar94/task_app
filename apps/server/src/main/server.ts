import { createHttpServer } from '../interfaces/http/createHttpServer.js';
import { openDatabase } from '../infrastructure/persistence/sqlite/openDatabase.js';
import { ClaudeInstructionWriter } from '../infrastructure/runtime/claude/ClaudeInstructionWriter.js';
import { ClaudeAgentRuntime } from '../infrastructure/runtime/claude/ClaudeAgentRuntime.js';
import { SdkMessageMapper } from '../infrastructure/runtime/claude/SdkMessageMapper.js';
import { ConsoleLogger } from '../infrastructure/system/ConsoleLogger.js';
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

  const container = createContainer({
    db: openDatabase(config.databasePath),
    runtime: new ClaudeAgentRuntime(new SdkMessageMapper(), claudeRuntimeConfig(config)),
    instructionWriter: new ClaudeInstructionWriter(config.claudeExecutablePath),
    logger,
    maxDelegationDepth: config.maxDelegationDepth,
    reservedPorts: config.reservedPorts,
  });

  const recovered = container.recoverInterruptedTasks.execute();
  if (recovered > 0) logger.info(`Marked ${recovered} interrupted task(s) as failed`);

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
