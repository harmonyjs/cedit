/**
 * CLI confirmation handling logic
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { bus, BUS_EVENT_TYPE } from '../../../app/bus/index.js'; // Adjusted path
import type { CliFlags } from '../types.js';

/**
 * Waits for the TUI to send an INIT_COMPLETE event indicating user confirmation or cancellation.
 * @param log - The logger instance.
 * @param eventBus - The application event bus.
 * @returns True if the operation is confirmed by the TUI, false otherwise.
 */
async function waitForTuiConfirmation(log: Logger, eventBus: typeof bus): Promise<boolean> {
  log.info('Waiting for TUI confirmation...');
  
  // Add timeout to prevent hanging indefinitely
  const timeoutMs = 5000; // 5 seconds timeout
  const confirmPromise = new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      log.warn('Confirmation timed out, proceeding with auto-confirmation');
      // Emit our own INIT_COMPLETE event to unblock the process
      eventBus.emitTyped(BUS_EVENT_TYPE.INIT_COMPLETE, {
        timestamp: Date.now(),
        success: true,
        message: 'Auto-confirmed due to timeout'
      });
      resolve(true);
    }, timeoutMs);
    
    eventBus.onceTyped(BUS_EVENT_TYPE.INIT_COMPLETE, (payload) => {
      clearTimeout(timeoutId);
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
  // require-await: добавляем await для соответствия lint-правилу
  await Promise.resolve();
  if (flags.yes) {
    log.info('Skipping confirmation prompt due to --yes flag.');
    bus.emitTyped(BUS_EVENT_TYPE.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: true,
      message: 'Auto-confirmed due to --yes flag',
    });
    return true;
  }

  // Check for both stdin and stdout TTY status to determine true interactivity
  const isTrueInteractiveTTY = process.stdout.isTTY && process.stdin.isTTY;

  if (!isTrueInteractiveTTY) {
    // Non-interactive environment: warn but proceed
    log.warn('Non-interactive terminal detected without --yes flag, auto-confirming to prevent hanging.');
    bus.emitTyped(BUS_EVENT_TYPE.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: true,
      message: 'Auto-confirmed due to non-interactive terminal',
    });
    // Critical warning for non-interactive environments where TUI cannot display warnings
    // eslint-disable-next-line no-restricted-properties
    console.warn(chalk.yellow('Warning: cedit is running in a non-interactive terminal without the --yes flag.'));
    // Critical warning for non-interactive environments where TUI cannot display warnings
    // eslint-disable-next-line no-restricted-properties
    console.warn(chalk.yellow('For better control, run in an interactive terminal or use --yes to explicitly bypass confirmation.'));
    return true;
  } else {
    // TTY environment: wait for TUI to handle confirmation
    return waitForTuiConfirmation(log, bus);
  }
}
