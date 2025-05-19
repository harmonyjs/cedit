/**
 * Handles the core execution flow of the CLI, from setup to completion.
 */
import chalk from 'chalk';
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path
import { bus, BUS_EVENT_TYPE } from '../../../app/bus/index.js'; // Adjusted path
import { handleConfirmation } from '../handlers/confirmation-handler.js'; // Adjusted path
import { startProcessing } from './lifecycle.js'; // Adjusted path
import { performInitialSetup } from './setup.js'; // Adjusted path
import type { Logger } from 'pino';
import { ResourceManager } from '../services/resource-manager.js'; // Adjusted path
import type { CliFlags } from '../types.js';
import { ProgressMonitor } from '../services/progress-monitor.js'; // Adjusted path
import { CompletionHandler } from '../handlers/completion-handler.js'; // Adjusted path

/**
 * Handles the user confirmation step.
 */
async function handleUserConfirmation(
  flags: CliFlags,
  log: Logger,
): Promise<boolean> {
  // require-await: добавляем await для соответствия lint-правилу
  await Promise.resolve();
  return handleConfirmation(flags, log);
}

/**
 * Initializes and starts progress tracking.
 */
function initializeAndStartProgressTracking(
  progressMonitor: ProgressMonitor,
  specPath: string,
): void {
  progressMonitor.start(); // Default interval
  console.log(chalk.blue(`Processing spec: ${chalk.cyan(specPath)}`));
}

/**
 * Initializes the ResourceManager, ProgressMonitor, CompletionHandler and emits the INIT_CONFIG event.
 */
function initializeServicesAndEmitConfig(
  log: Logger,
  cliCfg: CliConfig,
): {
  resourceManager: ResourceManager;
  progressMonitor: ProgressMonitor;
  completionHandler: CompletionHandler;
} {
  const resourceManager = new ResourceManager(bus, log);
  const progressMonitor = new ProgressMonitor(bus, log);
  const completionHandler = new CompletionHandler(bus, log);

  log.info({ config: cliCfg }, 'Effective configuration assembled');
  bus.emitTyped(BUS_EVENT_TYPE.INIT_CONFIG, { timestamp: Date.now(), config: cliCfg });
  return { resourceManager, progressMonitor, completionHandler };
}

/**
 * Executes the main CLI processing logic after initial setup and resource initialization.
 */
async function executeMainProcess({
  flags,
  cliCfg,
  log,
  runFn,
  progressMonitor,
  completionHandler,
}: {
  flags: CliFlags;
  cliCfg: CliConfig;
  log: Logger;
  runFn: (spec: string, cfg: CliConfig) => Promise<void>;
  progressMonitor: ProgressMonitor;
  completionHandler: CompletionHandler;
}): Promise<{ exitCode: number }> {
  const confirmed = await handleUserConfirmation(flags, log);
  if (!confirmed) {
    progressMonitor.stop();
    completionHandler.stopListening();
    return { exitCode: 0 }; // User cancelled
  }

  initializeAndStartProgressTracking(progressMonitor, flags.spec);
  
  startProcessing({
    spec: flags.spec,
    cliCfg,
    runFn,
    eventBus: bus,
    log,
  });

  const exitCode = await completionHandler.awaitCompletion();
  progressMonitor.stop();
  return { exitCode };
}

/**
 * Orchestrates the core CLI execution flow from initial setup to main process completion.
 * This function handles the "happy path" of CLI operation.
 * @returns An object containing the exit code, logger, and resource manager for cleanup.
 */
export async function orchestrateExecution( // Renamed function
  argv: string[],
  runFn: (spec: string, cfg: CliConfig) => Promise<void>,
  getLoggerFn: (scope: string, cfg: CliConfig) => Logger,
): Promise<{ exitCode: number; log: Logger; resourceManager: ResourceManager }> {
  // 1. Initial Setup
  const { log, flags, cliCfg } = await performInitialSetup(argv, getLoggerFn); // Adjusted function name

  // 2. Initialize Services (Resource Manager, Progress Monitor, Completion Handler) and Emit Config
  const { resourceManager, progressMonitor, completionHandler } = 
    initializeServicesAndEmitConfig(log, cliCfg);

  // 3. Main Process Execution
  const { exitCode } = await executeMainProcess({
    flags,
    cliCfg,
    log,
    runFn,
    progressMonitor,
    completionHandler,
  });

  return { exitCode, log, resourceManager };
}
