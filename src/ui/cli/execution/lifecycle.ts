/**
 * Helper functions for the CLI lifecycle, managing stages from initialization to completion.
 */
import { BUS_EVENT_TYPE, type bus } from '../../../app/bus/index.js';
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path
import { parseArguments } from './parser.js'; // Adjusted path and function name
import { loadConfiguration } from '../config/loader.js'; // Adjusted path
import type { CliFlags } from '../types.js';
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
  log.debug('State initialization completed');
  return { flags, cliCfg, log };
}

/**
 * Starts the main application processing function (runFn).
 * Accepts a single object parameter to comply with max-params lint rule.
 */
export function startProcessing({
  spec,
  cliCfg,
  runFn,
  eventBus,
  log,
}: {
  spec: string;
  cliCfg: CliConfig;
  runFn: (spec: string, cfg: CliConfig) => Promise<void>;
  eventBus: typeof bus;
  log: Logger;
}): void {
  runFn(spec, cliCfg).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error({ error: message, stack }, 'Unhandled error in runner (runFn)');
    // Emit FINISH_ABORT so that completion can be handled and CLI can exit.
    eventBus.emitTyped(BUS_EVENT_TYPE.FINISH_ABORT, {
      timestamp: Date.now(),
      reason: `Core process failed: ${message}`,
    });
  });
}
