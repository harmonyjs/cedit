/**
 * Handles the core execution flow of the CLI, from setup to completion.
 */
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
  log: Logger,
): void {
  progressMonitor.start(); // Default interval
  log.info(`Processing spec: ${specPath}`);
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
  log.debug('initializeServicesAndEmitConfig: before ResourceManager');
  const resourceManager = new ResourceManager(bus, log);
  log.debug('initializeServicesAndEmitConfig: after ResourceManager');
  const progressMonitor = new ProgressMonitor(bus, log);
  log.debug('initializeServicesAndEmitConfig: after ProgressMonitor');
  const completionHandler = new CompletionHandler(bus, log);
  log.debug('initializeServicesAndEmitConfig: after CompletionHandler');

  log.info({ config: cliCfg }, 'Effective configuration assembled');
  log.debug('initializeServicesAndEmitConfig: before bus.emitTyped INIT_CONFIG');
  bus.emitTyped(BUS_EVENT_TYPE.INIT_CONFIG, { timestamp: Date.now(), config: cliCfg });
  log.debug('initializeServicesAndEmitConfig: after bus.emitTyped INIT_CONFIG');
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
  log.debug('executeMainProcess: before handleUserConfirmation');
  const confirmed = await handleUserConfirmation(flags, log);
  log.debug('executeMainProcess: after handleUserConfirmation', { confirmed });
  if (!confirmed) {
    progressMonitor.stop();
    completionHandler.stopListening();
    log.debug('executeMainProcess: user not confirmed, exiting');
    return { exitCode: 0 }; // User cancelled
  }

  log.debug('executeMainProcess: before initializeAndStartProgressTracking');
  initializeAndStartProgressTracking(progressMonitor, flags.spec, log);
  log.debug('executeMainProcess: after initializeAndStartProgressTracking');

  log.debug('executeMainProcess: before startProcessing');
  startProcessing({
    spec: flags.spec,
    cliCfg,
    runFn,
    eventBus: bus,
    log,
  });
  log.debug('executeMainProcess: after startProcessing, before awaitCompletion');

  const exitCode = await completionHandler.awaitCompletion();
  log.debug('executeMainProcess: after awaitCompletion', { exitCode });
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
