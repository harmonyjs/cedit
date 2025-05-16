/**
 * Handles initial CLI setup, including version retrieval, argument parsing, 
 * configuration loading, and logger initialization.
 */
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path
import { parseArguments } from './parser.js'; // Adjusted path and function name
import { loadConfiguration } from '../config/loader.js'; // Adjusted path
import { getVersion } from '../services/version-manager.js'; // Adjusted path and function name
import type { CliFlags } from '../main.js'; // Adjusted path
import type { Logger } from 'pino';

/**
 * Performs initial CLI setup including argument parsing, 
 * configuration loading, and logger initialization.
 * @param argv Command line arguments.
 * @param getLoggerFn Function to initialize the logger.
 * @returns An object containing the initialized logger, flags, CLI config, and version.
 */
export async function performInitialSetup( // Renamed function
  argv: string[],
  getLoggerFn: (scope: string, cfg: CliConfig) => Logger,
): Promise<{ log: Logger; flags: CliFlags; cliCfg: CliConfig; version: string }> {
  const version = await getVersion(); // Adjusted function name
  const { flags } = await parseArguments(argv); // Adjusted function name
  const cliCfg = await loadConfiguration(flags);
  const log = getLoggerFn('cli', cliCfg);

  // Note: Critical flag validation (e.g., spec file path) is now handled within parseArguments.
  // If parseArguments throws, it will be caught by the main error handler in runCli.

  return { log, flags, cliCfg, version };
}
