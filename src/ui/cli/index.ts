/**
 * Core CLI logic for cedit, serving as the main entry point orchestrator.
 */
import chalk from 'chalk';
import type { CliConfig } from '../../app/model/index.js';
import { orchestrateExecution } from './execution/flow.js'; // Adjusted path
import type { Logger } from 'pino';
import type { ResourceManager } from './services/resource-manager.js'; // Adjusted path and type name

/**
 * Interface representing raw CLI flags parsed from command line.
 * This is used by multiple modules, so it remains here as a central definition.
 */
export interface CliFlags { 
  spec: string;
  dry_run: boolean | undefined;
  var: string[];
  log_level: string | undefined; 
  log_dir?: string;
  backup_dir?: string;
  max_tokens?: number;
  model?: string;
  retries?: number;
  sleep_ms?: number;
  yes: boolean;
}

/**
 * Interface for options returned by Commander.js program.opts().
 */
export interface CommanderOptionValues {
  dryRun?: boolean;
  var?: string[];
  logLevel?: string;
  logDir?: string;
  backupDir?: string;
  maxTokens?: number;
  model?: string;
  retries?: number;
  sleepMs?: number;
  yes?: boolean;
}

/**
 * Handles critical errors that occur during CLI execution.
 * Logs the error and prints it to the console.
 * @param err The error object.
 * @param log Optional logger instance for structured logging.
 */
function _handleCriticalError(err: unknown, log?: Logger): void {
  const errorMessage = err instanceof Error ? err.message : String(err);
  // Avoid double logging for spec file path error, as cli-parser now handles its specific error message.
  if (errorMessage !== 'Spec file path is required.' && !errorMessage.startsWith('Missing required argument: spec')) {
    console.error(chalk.red(`Critical CLI error: ${errorMessage}`));
  }
  const errorStack = err instanceof Error ? err.stack : undefined;

  if (log) {
    log.error({ error: errorMessage, stack: errorStack }, 'Critical CLI execution failed');
  } else if (errorStack && errorMessage !== 'Spec file path is required.' && !errorMessage.startsWith('Missing required argument: spec')) {
    console.error(chalk.dim(errorStack));
  }
}

/**
 * Core CLI logic, orchestrating setup, execution, and error handling.
 * @param argv Array of command line arguments (like process.argv)
 * @param runFn Function that runs the actual processing
 * @param getLoggerFn Function to initialize the logger
 * @returns Exit code (0 for success, 1 for error)
 */
export async function runCli(
  argv: string[],
  runFn: (spec: string, cfg: CliConfig) => Promise<void>,
  getLoggerFn: (scope: string, cfg: CliConfig) => Logger,
): Promise<number> {
  let overallLog: Logger | undefined;
  let overallResourceManager: ResourceManager | undefined; // Adjusted type name

  try {
    // orchestrateExecution now handles the main flow
    const result = await orchestrateExecution(argv, runFn, getLoggerFn);
    overallLog = result.log;
    overallResourceManager = result.resourceManager;
    return result.exitCode;
  } catch (err: unknown) {
    // _handleCriticalError is called if orchestrateExecution itself throws an unexpected error
    // or if errors occur before the logger is initialized within orchestrateExecution.
    _handleCriticalError(err, overallLog);
    return 1;
  } finally {
    if (overallResourceManager) {
      overallResourceManager.cleanup();
    }
    if (overallLog) {
      overallLog.debug('CLI run finished, all resources should be cleared by ResourceManager.');
    }
  }
}
