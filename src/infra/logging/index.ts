/**
 * Logging infrastructure for cedit CLI tool
 * 
 * This module provides a single, easy-to-consume logging helper that the whole
 * code-base can use without thinking about transports, formatting or log levels.
 * 
 * It implements a singleton pattern where the root logger is created once with
 * the CliConfig, and subsequent calls reuse it with different scopes.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as pino from 'pino';
import type { CliConfig } from '../../app/model/index.js';

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
  // Ensure logDir exists
  if (!fs.existsSync(config.log.dir)) {
    fs.mkdirSync(config.log.dir, { recursive: true });
  }
  
  const LOGFILE_DATE_LENGTH = 10; // YYYY-MM-DD
  const logfile = path.join(
    config.log.dir,
    new Date().toISOString().slice(0, LOGFILE_DATE_LENGTH) + '.log'
  );

  // Check if we're in development mode
  const isDev = process.env['NODE_ENV'] !== 'production';
  
  if (isDev) {
    // Using type assertion to inform TypeScript that this is safe
    return pino.default({
      level: config.log.level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    });
  }

  // base: null disables pid/hostname in pino >=8
  // Using type assertion to inform TypeScript that this is safe
  return pino.default(
    {
      level: config.log.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      base: null // disables pid, hostname for brevity
    },
    pino.destination({ dest: logfile, sync: false })
  );
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