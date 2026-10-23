import type { Logger } from '../../application/ports/Logger.js';

export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.log(`[fleet] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[fleet] ${message}`);
  }

  error(message: string, error: unknown): void {
    console.error(`[fleet] ${message}`, error);
  }
}
