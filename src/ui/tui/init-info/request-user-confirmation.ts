import { confirm, cancel } from '@clack/prompts';
import { bus, BusEventType } from '../../../app/bus/index.js';

/**
 * Prompts the user for confirmation to proceed with the cedit operation.
 * Emits INIT_COMPLETE event with the user's decision.
 */
export async function requestUserConfirmation(): Promise<void> {
  if (!process.stdout.isTTY) {
    bus.emitTyped(BusEventType.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: true,
      message: 'Auto-confirmed (not in TTY)'
    });
    return;
  }
  const specPath = process.argv.find(arg => !arg.startsWith('-') && (arg.endsWith('.yml') || arg.endsWith('.yaml'))) || 'unknown spec';
  const specName = specPath.includes('/') ? specPath.split('/').pop() : specPath;
  const result = await confirm({
    message: `Run cedit with spec "${specName}"?`
  });
  bus.emitTyped(BusEventType.INIT_COMPLETE, {
    timestamp: Date.now(),
    success: result === true,
    message: result === true ? 'User confirmed' : 'User cancelled'
  });
  if (result !== true) {
    cancel('Operation cancelled.');
  }
}
