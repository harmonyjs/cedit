/**
 * CLI confirmation handling logic
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { bus, BusEventType } from '../../../app/bus/index.js'; // Adjusted path
import type { CliFlags } from '../main.js'; // Adjusted path, assuming CliFlags will be in main.ts

/**
 * Waits for the TUI to send an INIT_COMPLETE event indicating user confirmation or cancellation.
 * @param log - The logger instance.
 * @param eventBus - The application event bus.
 * @returns True if the operation is confirmed by the TUI, false otherwise.
 */
async function _waitForTuiConfirmation(log: Logger, eventBus: typeof bus): Promise<boolean> {
  log.info('Waiting for TUI confirmation...');
  const confirmPromise = new Promise<boolean>((resolve) => {
    eventBus.onceTyped(BusEventType.INIT_COMPLETE, (payload) => {
      log.info({ payload }, 'Received INIT_COMPLETE from TUI');
      resolve(payload.success);
    });
  });

  const confirmed = await confirmPromise;
  if (!confirmed) {
    log.info('User cancelled operation via TUI.');
    // INIT_COMPLETE with success:false is expected to be emitted by the TUI in this case
    return false;
  }
  // INIT_COMPLETE with success:true is expected to be emitted by the TUI
  return true;
}

/**
 * Handles the user confirmation step based on CLI flags and TTY status.
 *
 * @param flags - Parsed CLI flags.
 * @param log - The logger instance.
 * @returns True if the operation is confirmed, false otherwise.
 */
export async function handleConfirmation( // Renamed function
  flags: CliFlags,
  log: Logger,
): Promise<boolean> {
  if (flags.yes) {
    log.info('Skipping confirmation prompt due to --yes flag.');
    bus.emitTyped(BusEventType.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: true,
      message: 'Auto-confirmed due to --yes flag',
    });
    return true;
  }

  const isTTY = process.stdout.isTTY;

  if (!isTTY) {
    // Non-TTY environment: error out
    console.error(chalk.red('Error: cedit requires an interactive terminal for confirmation prompts when run without the --yes flag.'));
    console.error(chalk.yellow('Please run in an interactive terminal or use the --yes flag to bypass this confirmation.'));
    bus.emitTyped(BusEventType.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: false,
      message: 'Non-interactive terminal without --yes flag, confirmation required.',
    });
    return false;
  } else {
    // TTY environment: wait for TUI to handle confirmation
    return _waitForTuiConfirmation(log, bus);
  }
}
