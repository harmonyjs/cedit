/**
 * Terminal User Interface (TUI) for cedit CLI tool
 *
 * This module provides interactive terminal UI components using clack.
 * It subscribes to events from the Event Bus and displays them in a user-friendly way.
 *
 * Unlike the CLI module which handles command-line arguments and configuration,
 * this module focuses on real-time interactive display during the execution.
 */

import {
  spinner as clackSpinner, // Renamed to avoid conflict
  confirm as clackConfirm, // Renamed
  isCancel as clackIsCancel, // Renamed
  cancel as clackCancel, // Renamed
  select as clackSelect, // Added for confirmApplyChanges
} from '@clack/prompts';
import { bus } from '../../app/bus/index.js';
import type { CliConfig, DomainEvent } from '../../app/model/index.js';
import { getLogger } from '../../infra/logging/index.js';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { handleInitConfigEvent } from './init-info/index.js';
import {
  injectTuiDeps as injectEventListenerDeps,
  setupActualEventListeners,
} from './event-listeners/index.js';
import {
  handleFileViewedEvent,
  handleFileEditedEvent,
  handleFileCreatedEvent,
  handleBackupCreatedEvent,
  handleErrorRaisedEvent,
} from './domain-handlers/index.js';
import { initLogHandler } from './log-handler.js';
import type * as pino from 'pino';

// --- START: TUI Utility Functions (conceptually tui-utils.ts) ---
let tuiLoggerInternal: pino.Logger;
let activeSpinnerInstance: ReturnType<typeof clackSpinner> | null = null;

function injectTuiUtilDepsInternal(deps: { logger: pino.Logger }): void {
  tuiLoggerInternal = deps.logger;
}

export function isTUIEnvironment(): boolean {
  const isTTY = process.stdout.isTTY;
  const isCI =
    process.env['CI'] === 'true' ||
    (process.env['GITHUB_ACTIONS'] !== undefined && process.env['GITHUB_ACTIONS'] !== '') ||
    (process.env['GITLAB_CI'] !== undefined && process.env['GITLAB_CI'] !== '') ||
    (process.env['JENKINS_URL'] !== undefined && process.env['JENKINS_URL'] !== '');
  return isTTY && !isCI;
}

export async function showConfirmation(message: string): Promise<boolean> {
  if (!isTUIEnvironment()) return true;

  const confirmed = await clackConfirm({ message });

  if (clackIsCancel(confirmed) || !confirmed) {
    clackCancel('Operation cancelled.');
    return false;
  }
  return true;
}

/**
 * Presents a selection prompt to confirm applying changes
 * Returns true if user wants to proceed, false otherwise
 */
export async function confirmApplyChanges(): Promise<boolean> {
  if (!isTUIEnvironment()) return true;
  
  const result = await clackSelect({
    message: 'Apply these changes to your project?',
    options: [
      { label: 'Yes, apply all changes', value: true },
      { label: 'No, cancel the operation', value: false }
    ]
  });
  
  if (clackIsCancel(result) || result === false) {
    clackCancel('Operation cancelled.');
    return false;
  }
  
  return true;
}

/**
 * Creates a spinner for LLM processing
 * Returns the spinner instance or null if not in TUI environment
 */
export function startLLMProcessing(): ReturnType<typeof clackSpinner> | null {
  return createSpinner('Sending to Claude...');
}

/**
 * Updates the active spinner message based on domain event
 */
export function updateSpinnerWithEvent(event: DomainEvent): void {
  const spinner = getActiveSpinner();
  if (!spinner || !isTUIEnvironment()) return;
  
  switch (event.type) {
    case 'FileViewed':
      spinner.message(`Viewing ${event.path} (${event.lines} lines)`);
      break;
    case 'FileEdited':
      spinner.message(`Editing ${event.path}`);
      break;
    case 'FileCreated':
      spinner.message(`Creating ${event.path}`);
      break;
    case 'BackupCreated':
      spinner.message(`Backing up ${event.originalPath}`);
      break;
    case 'ErrorRaised':
      spinner.message(`Error: ${event.message}`);
      break;
    default: {
      const _exhaustiveCheck: never = event;
      if (typeof tuiLoggerInternal !== 'undefined') {
        tuiLoggerInternal.warn(
          { eventType: (_exhaustiveCheck as DomainEvent).type },
          'Unhandled event type in updateSpinnerWithEvent'
        );
      }
    }
  }
}

export function createSpinner(message: string): ReturnType<typeof clackSpinner> | null {
  if (!isTUIEnvironment()) return null;
  if (activeSpinnerInstance) {
    activeSpinnerInstance.stop();
  }
  activeSpinnerInstance = clackSpinner();
  activeSpinnerInstance.start(message);
  return activeSpinnerInstance;
}

export function stopActiveSpinner(): void {
  if (activeSpinnerInstance) {
    activeSpinnerInstance.stop();
    activeSpinnerInstance = null;
  }
}

export function getActiveSpinner(): ReturnType<typeof clackSpinner> | null {
  return activeSpinnerInstance;
}

export function getVersion(): string {
  try {
    return '0.2.0'; // Placeholder
  } catch (error) {
    if (typeof tuiLoggerInternal !== 'undefined') {
      tuiLoggerInternal.error({ error }, 'Failed to read version');
    } else {
      // Fallback error logging when logger is not yet initialized
      // eslint-disable-next-line no-restricted-properties
      console.error('Failed to read version, logger not init', error);
    }
    return '0.0.0';
  }
}
// --- END: TUI Utility Functions ---

let logger: pino.Logger; // Main logger for this module (index.ts)

/**
 * Dispatches domain events to their specific handlers.
 */
function dispatchDomainEvent(busEventType: string, domainEvent: DomainEvent): void {
  if (!isTUIEnvironment()) return;
  const currentSpinner = getActiveSpinner(); // Use getter
  switch (domainEvent.type) {
    case 'FileViewed':
      handleFileViewedEvent(domainEvent, currentSpinner);
      break;
    case 'FileEdited':
      handleFileEditedEvent(domainEvent);
      break;
    case 'FileCreated':
      handleFileCreatedEvent(domainEvent);
      break;
    case 'BackupCreated':
      handleBackupCreatedEvent(domainEvent);
      break;
    case 'ErrorRaised':
      handleErrorRaisedEvent(domainEvent, currentSpinner);
      stopActiveSpinner(); // Use stopper
      break;
    default: {
      const _exhaustiveCheck: never = domainEvent;
      logger.warn(
        { busEventType, eventSubtype: (_exhaustiveCheck as DomainEvent).type },
        'Received unhandled domain event subtype in dispatchDomainEvent',
      );
    }
  }
}

/**
 * Initialize the TUI module
 */
export function initTUI(config: CliConfig): void {
  logger = getLogger('tui', config);
  injectTuiUtilDepsInternal({ logger }); // Inject logger into our internal utils
  logger.info('TUI initialized');

  initLogHandler(); // Initialize the log handler to capture all logs

  if (process.env['NODE_ENV'] === 'development') {
    bus.setDebugMode(true);
  }

  injectEventListenerDeps({
    logger,
    // Pass spinner management functions to event-listeners
    getActiveSpinner,
    stopActiveSpinner,
    dispatchDomainEvent,
    handleInitConfigEvent,
    getVersion,
    fs,
    fsSync,
  });
  setupActualEventListeners(bus);
}

/**
 * Clean up the TUI (remove event listeners)
 */
export function cleanupTUI(): void {
  stopActiveSpinner(); // Use stopper
  bus.clearAllListeners();
  if (typeof logger !== 'undefined') {
    logger.info('TUI cleaned up');
  }
}