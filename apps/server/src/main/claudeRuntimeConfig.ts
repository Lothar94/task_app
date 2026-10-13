import type { ClaudeRuntimeConfig } from '../infrastructure/runtime/claude/buildSdkOptions.js';
import type { AppConfig } from './config.js';

export function claudeRuntimeConfig(config: AppConfig): ClaudeRuntimeConfig {
  return {
    bashMaxOutputChars: config.bashMaxOutputChars,
    ...(config.bashRewriteHook ? { bashRewriteHook: config.bashRewriteHook } : {}),
    ...(config.claudeExecutablePath ? { executablePath: config.claudeExecutablePath } : {}),
  };
}
