import type { DomainEvent } from '../../../app/model/index.js';
import { log, note, outro, cancel, type spinner as ClackSpinnerType } from '@clack/prompts'; // Merged spinner type import
import chalk from 'chalk';
import {
  BUS_EVENT_TYPE,
  BUS_NAMESPACE,
  type FinishAbortEvent as FinishAbortedPayload,
  type FinishSummaryEvent as FinishSummaryPayload,
  type InitConfigEvent,
  type bus as BusInstance,
} from '../../../app/bus/index.js';

/**
 * Logger interface for dependency injection.
 * This should be compatible with the logger instance from getLogger (pino).
 */
type Logger = {
  info: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  warn: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  error: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  debug: (obj: Record<string, unknown> | string, msg?: string, ...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => Logger; // pino's child logger method
};

/**
 * Spinner control functions interface for dependency injection.
 */
type SpinnerControls = {
  getActiveSpinner: () => ReturnType<typeof ClackSpinnerType> | null;
  stopActiveSpinner: () => void;
};

interface HandleInitConfigEventDeps {
  logger: Logger;
  getVersion: () => string;
  fs: typeof import('node:fs/promises');
  fsSync: typeof import('node:fs');
}

// These will be injected from the main TUI module
let loggerInstance: Logger;
// let activeSpinner: Spinner | null; // Removed direct activeSpinner
let spinnerControls: SpinnerControls; // Added spinner control functions
let dispatchDomainEventFn: (busEventType: string, domainEvent: DomainEvent) => void;
let handleInitConfigEventFn: (payload: InitConfigEvent, deps: HandleInitConfigEventDeps) => Promise<void>;
let getVersionInstance: () => string;
let fsInstance: typeof import('node:fs/promises');
let fsSyncInstance: typeof import('node:fs');

export function injectTuiDeps(deps: {
  logger: Logger;
  // activeSpinner: Spinner | null; // Removed
  getActiveSpinner: () => ReturnType<typeof ClackSpinnerType> | null; // Updated type
  stopActiveSpinner: () => void;
  dispatchDomainEvent: (busEventType: string, domainEvent: DomainEvent) => void;
  handleInitConfigEvent: (
    payload: InitConfigEvent,
    deps: HandleInitConfigEventDeps,
  ) => Promise<void>;
  getVersion: () => string;
  fs: typeof import('node:fs/promises');
  fsSync: typeof import('node:fs');
}): void {
  loggerInstance = deps.logger;
  // activeSpinner = deps.activeSpinner; // Removed
  spinnerControls = {
    getActiveSpinner: deps.getActiveSpinner,
    stopActiveSpinner: deps.stopActiveSpinner,
  };
  dispatchDomainEventFn = deps.dispatchDomainEvent;
  handleInitConfigEventFn = deps.handleInitConfigEvent;
  getVersionInstance = deps.getVersion;
  fsInstance = deps.fs;
  fsSyncInstance = deps.fsSync;
}

export function setupActualEventListeners(bus: typeof BusInstance): void {
  // Listen for init events
   
  bus.onTyped(BUS_EVENT_TYPE.INIT_CONFIG, (payload: InitConfigEvent) => {
    loggerInstance.debug('TUI event-listeners: INIT_CONFIG received');
    handleInitConfigEventFn(payload, {
      logger: loggerInstance,
      getVersion: getVersionInstance,
      fs: fsInstance,
      fsSync: fsSyncInstance
    }).then(() => {
      loggerInstance.debug('TUI event-listeners: handleInitConfigEventFn resolved');
    }).catch((error: unknown) => {
      loggerInstance.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in handleInitConfigEvent');
      bus.emitTyped(BUS_EVENT_TYPE.FINISH_ABORT, {
        timestamp: Date.now(),
        reason: 'Error during TUI initialization'
      });
      if (process.stdout.isTTY) {
        cancel('Operation failed during initialization.');
      }
    });
  });

  // Listen for domain events
   
  bus.onNamespace(BUS_NAMESPACE.DOMAIN, (busEventType, payload) => {
    if (!process.stdout.isTTY) return;
    
    if (isValidDomainEvent(payload)) {
      const domainEvent = (payload as { event: DomainEvent }).event;
      dispatchDomainEventFn(String(busEventType), domainEvent);
    } else {
      loggerInstance.warn(
        { busEventType: String(busEventType), payloadType: typeof payload },
        'Received DOMAIN_EVENT_EMITTED with unexpected payload structure (missing event property)'
      );
    }
  });

  // Listen for finish events
   
  bus.onTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, (payload: FinishSummaryPayload) => {
    handleFinishSummaryListener(payload);
  });

   
  bus.onTyped(BUS_EVENT_TYPE.FINISH_ABORT, (payload: FinishAbortedPayload) => {
    handleFinishAbortListener(payload);
  });
}

export function handleFinishSummaryListener(payload: FinishSummaryPayload): void {
  if (!process.stdout.isTTY) return;
  // if (activeSpinner) { // Old way
  //   activeSpinner.stop('Processing complete');
  //   activeSpinner = null;
  // }
  const currentSpinner = spinnerControls.getActiveSpinner();
  if (currentSpinner) {
    currentSpinner.stop('Processing complete');
    spinnerControls.stopActiveSpinner(); // Ensure it's nulled out via the utility
  }
  const { stats, duration } = payload;
  const { totalEdits, filesEdited, filesCreated, backupsCreated } = stats;
  const { added, removed, changed } = totalEdits;
  log.step('Summary:');
  log.info(`Files: ${chalk.cyan(filesEdited)} edited, ${chalk.cyan(filesCreated)} created, ${chalk.cyan(backupsCreated)} backups`);
  log.info(`Changes: ${chalk.green(`+${added}`)} added, ${chalk.red(`-${removed}`)} removed, ${chalk.yellow(`~${changed}`)} changed`);
  // Magic number 1000: ms to seconds conversion; 2: fixed decimal places for display
  const MS_PER_SECOND = 1000;
  const SUMMARY_DECIMAL_PLACES = 2;
  log.info(`Duration: ${chalk.gray(`${(duration / MS_PER_SECOND).toFixed(SUMMARY_DECIMAL_PLACES)}s`)}`);
  if (filesEdited > 0 || filesCreated > 0) {
    note(
      `Tip: open files above to review; rerun with --dry-run anytime`,
      'Next Steps'
    );
  }
  outro(chalk.green('✨ All done! ✨'));
}

export function handleFinishAbortListener(payload: FinishAbortedPayload): void {
  if (!process.stdout.isTTY) return;
  // if (activeSpinner) { // Old way
  //   activeSpinner.stop(chalk.red(`Aborted: ${payload.reason}`));
  //   activeSpinner = null;
  // } else {
  //   log.error(`Aborted: ${chalk.red(payload.reason)}`);
  // }
  const currentSpinner = spinnerControls.getActiveSpinner();
  if (currentSpinner) {
    currentSpinner.stop(chalk.red(`Aborted: ${payload.reason}`));
    spinnerControls.stopActiveSpinner(); // Ensure it's nulled out
  } else {
    log.error(`Aborted: ${chalk.red(payload.reason)}`);
  }
  if (payload.code !== undefined && payload.code !== null && payload.code !== '') {
    log.info(`Code: ${chalk.gray(payload.code)}`);
  }
  outro(chalk.red('Operation aborted'));
}

/**
 * Validates if the payload contains a valid domain event structure.
 */
function isValidDomainEvent(payload: unknown): boolean {
  return (
    payload !== null &&
    payload !== undefined &&
    typeof payload === 'object' &&
    'event' in payload &&
    payload.event !== null &&
    payload.event !== undefined &&
    typeof payload.event === 'object' &&
    'type' in payload.event
  );
}