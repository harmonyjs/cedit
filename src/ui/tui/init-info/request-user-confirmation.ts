import { confirm, cancel } from '@clack/prompts';
import { bus, BUS_EVENT_TYPE } from '../../../app/bus/index.js';

/**
 * Prompts the user for confirmation to proceed with the cedit operation.
 * Emits INIT_COMPLETE event with the user's decision.
 */
export async function requestUserConfirmation(): Promise<void> {
  if (!process.stdout.isTTY) {
    bus.emitTyped(BUS_EVENT_TYPE.INIT_COMPLETE, {
      timestamp: Date.now(),
      success: true,
      message: 'Auto-confirmed (not in TTY)'
    });
    return;
  }

  const specPath = findSpecPathFromArgs(process.argv) ?? 'unknown spec';
  const specName = extractSpecName(specPath);
  const result = await confirm({
    message: `Run cedit with spec "${specName}"?`
  });

  bus.emitTyped(BUS_EVENT_TYPE.INIT_COMPLETE, {
    timestamp: Date.now(),
    success: result === true,
    message: result === true ? 'User confirmed' : 'User cancelled'
  });
  if (result !== true) {
    cancel('Operation cancelled.');
  }
}

/**
 * Finds the first spec file path from the given arguments.
 */
function findSpecPathFromArgs(args: string[]): string | undefined {
  for (const arg of args) {
    if (
      typeof arg === 'string' &&
      arg !== '' &&
      !arg.startsWith('-') &&
      (arg.endsWith('.yml') || arg.endsWith('.yaml'))
    ) {
      return arg;
    }
  }
  return undefined;
}

/**
 * Extracts the spec file name from a path.
 */
function extractSpecName(specPath: string): string {
  if (typeof specPath === 'string' && specPath !== '' && specPath.includes('/')) {
    const parts = specPath.split('/');
    const lastPart = parts[parts.length - 1];
    if (typeof lastPart === 'string' && lastPart !== '') {
      return lastPart;
    }
  }
  return specPath;
}
