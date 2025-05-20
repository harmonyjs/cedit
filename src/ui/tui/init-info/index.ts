import chalk from 'chalk';
import { intro, log } from '@clack/prompts';
import type { CliConfig } from '../../../app/model/index.js';
import { requestUserConfirmation } from './request-user-confirmation.js';

// Define Logger type consistent with event-listeners
type Logger = {
  info: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  error: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  debug: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

/**
 * Displays initial TUI elements like intro, model info, and dry run warning.
 */
export function displayInitialInfo(config: CliConfig, getVersion: () => string): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1Bc'); // Clear screen
  intro(`cedit v${getVersion()}`);
  log.info(`Using model: ${chalk.cyan(config.model)}`);
  if (config.dryRun === true) {
    log.warn(chalk.yellow('DRY RUN MODE - No files will be modified'));
  }
}

/**
 * Tries to find and log the path of the loaded configuration file.
 */
export async function logLoadedConfigFile(fs: typeof import('node:fs/promises'), fsSync: typeof import('node:fs'), logger: Pick<Logger, 'error'>): Promise<void> {
  if (!process.stdout.isTTY) return;
  try {
    const homeDir = (process.env['HOME'] !== undefined && process.env['HOME'] !== '') ? 
                    process.env['HOME'] : 
                    ((process.env['USERPROFILE'] !== undefined && process.env['USERPROFILE'] !== '') ? 
                    process.env['USERPROFILE'] : 
                    '');
    const candidates = [
      './.cedit.yml',
      `${homeDir}/.config/cedit/config.yml`,
      `${homeDir}/.cedit.yml`,
    ];
    for (const candidate of candidates) {
      try {
        await fs.access(candidate, fsSync.constants.R_OK);
        log.step('Loaded config');
        log.message(candidate, { symbol: chalk.gray('│') });
        return; // Found and logged
      } catch {
        // File doesn't exist or isn't readable, continue
      }
    }
  } catch (error: unknown) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error checking for config files');
  }
}

interface HandleInitConfigEventDeps {
  logger: Pick<Logger, 'info' | 'error'>; // Use Pick for the specific methods needed
  getVersion: () => string;
  fs: typeof import('node:fs/promises');
  fsSync: typeof import('node:fs');
}

/**
 * Handles the INIT_CONFIG event by orchestrating display and confirmation.
 */
export async function handleInitConfigEvent(
  payload: { config: CliConfig },
  deps: HandleInitConfigEventDeps
): Promise<void> {
  const { config } = payload;
  const { logger, getVersion, fs, fsSync } = deps;
  logger.info({ config }, 'Received init config event');

  displayInitialInfo(config, getVersion);
  // Pass only the error method of logger, or adjust logLoadedConfigFile to accept the full logger type
  await logLoadedConfigFile(fs, fsSync, { error: logger.error });
  await requestUserConfirmation();
}
