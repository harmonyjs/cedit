import type { DomainEvent } from '../../../app/model/index.js';
import { log, note, outro, cancel } from '@clack/prompts';
import chalk from 'chalk';
import {
  bus as BusInstance, // Use an alias for the instance if needed, or use its type
  BusEventType,
  BusNamespace,
  type FinishAbortEvent as FinishAbortedPayload, // Alias to match usage
  type FinishSummaryEvent as FinishSummaryPayload, // Alias to match usage
  type InitConfigEvent
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
 * Spinner interface for dependency injection.
 */
type Spinner = {
  stop: (message?: string) => void;
};

interface HandleInitConfigEventDeps {
  logger: Logger;
  getVersion: () => string;
  fs: typeof import('node:fs/promises');
  fsSync: typeof import('node:fs');
}

// These will be injected from the main TUI module
let loggerInstance: Logger;
let activeSpinner: Spinner | null;
let dispatchDomainEventFn: (busEventType: string, domainEvent: DomainEvent) => void;
let handleInitConfigEventFn: (payload: InitConfigEvent, deps: HandleInitConfigEventDeps) => Promise<void>;
let getVersionInstance: () => string;
let fsInstance: typeof import('node:fs/promises');
let fsSyncInstance: typeof import('node:fs');

export function injectTuiDeps(deps: {
  logger: Logger;
  activeSpinner: Spinner | null;
  dispatchDomainEvent: (busEventType: string, domainEvent: DomainEvent) => void;
  handleInitConfigEvent: (payload: InitConfigEvent, deps: HandleInitConfigEventDeps) => Promise<void>;
  getVersion: () => string;
  fs: typeof import('node:fs/promises');
  fsSync: typeof import('node:fs');
}) {
  loggerInstance = deps.logger;
  activeSpinner = deps.activeSpinner;
  dispatchDomainEventFn = deps.dispatchDomainEvent;
  handleInitConfigEventFn = deps.handleInitConfigEvent;
  getVersionInstance = deps.getVersion;
  fsInstance = deps.fs;
  fsSyncInstance = deps.fsSync;
}

export function setupActualEventListeners(bus: typeof BusInstance): void {
  // Listen for init events
  bus.onTyped(BusEventType.INIT_CONFIG, (payload: InitConfigEvent) => {
    handleInitConfigEventFn(payload, {
      logger: loggerInstance,
      getVersion: getVersionInstance,
      fs: fsInstance,
      fsSync: fsSyncInstance
    }).catch((error: unknown) => {
      loggerInstance.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in handleInitConfigEvent');
      bus.emitTyped(BusEventType.FINISH_ABORT, {
        timestamp: Date.now(),
        reason: 'Error during TUI initialization'
      });
      if (process.stdout.isTTY) {
        cancel('Operation failed during initialization.');
      }
    });
  });

  // Listen for domain events
  bus.onNamespace(BusNamespace.DOMAIN, (busEventType, payload) => {
    if (!process.stdout.isTTY) return;
    if (
      payload &&
      typeof payload === 'object' &&
      'event' in payload &&
      (payload as { event: unknown }).event &&
      typeof (payload as { event: unknown }).event === 'object' &&
      (payload as { event: { type?: unknown } }).event &&
      'type' in (payload as { event: { type?: unknown } }).event
    ) {
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
  bus.onTyped(BusEventType.FINISH_SUMMARY, (payload: FinishSummaryPayload) => {
    handleFinishSummaryListener(payload);
  });

  bus.onTyped(BusEventType.FINISH_ABORT, (payload: FinishAbortedPayload) => {
    handleFinishAbortListener(payload);
  });
}

export function handleFinishSummaryListener(payload: FinishSummaryPayload): void {
  if (!process.stdout.isTTY) return;
  if (activeSpinner) {
    activeSpinner.stop('Processing complete');
    activeSpinner = null;
  }
  const { stats, duration } = payload;
  const { totalEdits, filesEdited, filesCreated, backupsCreated } = stats;
  const { added, removed, changed } = totalEdits;
  log.step('Summary:');
  log.info(`Files: ${chalk.cyan(filesEdited)} edited, ${chalk.cyan(filesCreated)} created, ${chalk.cyan(backupsCreated)} backups`);
  log.info(`Changes: ${chalk.green(`+${added}`)} added, ${chalk.red(`-${removed}`)} removed, ${chalk.yellow(`~${changed}`)} changed`);
  log.info(`Duration: ${chalk.gray(`${(duration / 1000).toFixed(2)}s`)}`);
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
  if (activeSpinner) {
    activeSpinner.stop(chalk.red(`Aborted: ${payload.reason}`));
    activeSpinner = null;
  } else {
    // loggerInstance.error is not a function, assuming log.error from @clack/prompts
    log.error(`Aborted: ${chalk.red(payload.reason)}`);
  }
  if (payload.code) {
    log.info(`Code: ${chalk.gray(payload.code)}`);
  }
  outro(chalk.red('Operation aborted'));
}
