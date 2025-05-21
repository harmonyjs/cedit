/**
 * Logging infrastructure for cedit CLI tool
 * 
 * This module provides a single, easy-to-consume logging helper that the whole
 * code-base can use without thinking about transports, formatting or log levels.
 * 
 * It implements a singleton pattern where the root logger is created once with
 * the CliConfig, and subsequent calls reuse it with different scopes.
 * 
 * All log output is directed to the event bus first, allowing the TUI to control
 * what's visible in the terminal via Clack, while still maintaining file logging.
 */

import type * as pino from 'pino';
import type { CliConfig } from '../../app/model/index.js';
import { createEventBusLogger } from './transport.js';

/**
 * Root (singleton) pino logger. Created once per process.
 * Do NOT export it directly – always use getLogger().
 */
let rootLogger: pino.Logger | null = null;

/**
 * Creates the root logger with the given configuration.
 * This is called only once per process.
 */
function createRootLogger(config: CliConfig): pino.Logger {
  // Determine if we're in a CLI-only environment by checking the TUI_DISABLED env var
  const isTuiDisabled = process.env['TUI_DISABLED'] === 'true' || 
                       !process.stdout.isTTY ||
                       process.env['CI'] === 'true';
  
  // If TUI is disabled, use standard Pino logger with file output
  if (isTuiDisabled) {
    return createEventBusLogger({
      level: config.log.level,
      logDir: config.log.dir,
      eventBusOnly: false // Write to both event bus and file
    });
  }

  // In TUI mode, use the event bus transport only
  return createEventBusLogger({
    level: config.log.level,
    logDir: config.log.dir,
    eventBusOnly: true // Only emit to event bus, no direct stdout output
  });
}

/**
 * Returns a namespaced logger. Example: `const log = getLogger('storage');`
 * 
 * The first call must provide a CliConfig to initialize the root logger.
 * Subsequent calls can omit the config parameter.
 * 
 * @param scope - The logical source of the log (e.g., 'storage', 'cli')
 * @param config - The CLI configuration (required only for first call)
 * @returns A scoped logger instance
 * @throws {Error} When root logger is not initialized and no config is provided
 */
export function getLogger(scope: string, config?: CliConfig): pino.Logger {
  if (!rootLogger) {
    if (!config) {
      throw new Error('Root logger not initialised: supply CliConfig');
    }
    rootLogger = createRootLogger(config);
  }
  return rootLogger.child({ scope });
}