/**
 * Helper functions for the CLI lifecycle, managing stages from initialization to completion.
 */
import { bus, BusEventType } from '../../../app/bus/index.js'; // Adjusted path
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path
import { parseArguments } from './parser.js'; // Adjusted path and function name
import { loadConfiguration } from '../config/loader.js'; // Adjusted path
import type { CliFlags } from '../main.js'; // Adjusted path
import type { Logger } from 'pino';

/**
 * Initializes CLI state by parsing arguments, loading configuration, and setting up the logger.
 * @param argv - Command line arguments.
 * @param getLoggerFn - Function to get a logger instance.
 * @returns A promise that resolves to an object containing flags, CLI config, and logger.
 */
export async function initializeState( // Renamed function
  argv: string[],
  getLoggerFn: (scope: string, cfg: CliConfig) => Logger,
): Promise<{ flags: CliFlags; cliCfg: CliConfig; log: Logger }> {
  const { flags } = await parseArguments(argv); // Adjusted function name
  const cliCfg = await loadConfiguration(flags);
  const log = getLoggerFn('cli', cliCfg);
  return { flags, cliCfg, log };
}

/**
 * Starts the main application processing function (runFn).
 * Handles errors from runFn and emits a FINISH_ABORT event if necessary.
 * @param spec - The specification file path.
 * @param cliCfg - The CLI configuration.
 * @param runFn - The main function to execute the application's core logic.
 * @param eventBus - The application's event bus.
 * @param log - The logger instance.
 */
export function startProcessing( // Renamed function
  spec: string,
  cliCfg: CliConfig,
  runFn: (spec: string, cfg: CliConfig) => Promise<void>,
  eventBus: typeof bus,
  log: Logger,
): void {
  runFn(spec, cliCfg).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error({ error: message, stack }, 'Unhandled error in runner (runFn)');
    // Emit FINISH_ABORT so that completion can be handled and CLI can exit.
    eventBus.emitTyped(BusEventType.FINISH_ABORT, {
      timestamp: Date.now(),
      reason: `Core process failed: ${message}`,
    });
  });
}
