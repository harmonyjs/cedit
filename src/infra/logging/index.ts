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
 * Environment variable names used to determine logging behavior
 */
const ENV = {
  TUI_DISABLED: 'TUI_DISABLED',
  CI: 'CI'
};

/**
 * Root (singleton) pino logger. Created once per process.
 * Do NOT export it directly – always use getLogger().
 */
let rootLogger: pino.Logger | null = null;

/**
 * Determines if we're running in a non-interactive environment (CI, non-TTY, or TUI explicitly disabled)
 */
function isNonInteractiveEnvironment(): boolean {
  return process.env[ENV.TUI_DISABLED] === 'true' || 
         !process.stdout.isTTY ||
         process.env[ENV.CI] === 'true';
}

/**
 * Creates the root logger with the given configuration.
 * This is called only once per process.
 */
function createRootLogger(config: CliConfig): pino.Logger {
  const shouldUseFileOutput = isNonInteractiveEnvironment();
  
  return createEventBusLogger({
    level: config.log.level,
    logDir: config.log.dir,
    // In non-interactive mode, write to both event bus and file
    // In interactive mode, only emit to event bus
    eventBusOnly: !shouldUseFileOutput
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
  const childLogger = rootLogger.child({ scope });
  return childLogger;
}