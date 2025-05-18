/**
 * Terminal User Interface (TUI) for cedit CLI tool
 * 
 * This module provides interactive terminal UI components using clack.
 * It subscribes to events from the Event Bus and displays them in          default:
          // event is 'never' here because the switch should be exhaustive.
          // payload.event still holds the original DomainEvent.
          logger.warn({ busEventType: BusEventType.DOMAIN_EVENT_EMITTED, eventSubtype: payload.event.type }, 'Received unknown domain event subtype from DOMAIN_EVENT_EMITTED');
      }
    } else {
      // This case implies BusEventType.DOMAIN_EVENT_EMITTED was received,
      // but isDomainEventWrapper(payload) was false.
      logger.warn({ busEventType: BusEventType.DOMAIN_EVENT_EMITTED, payloadType: typeof payload }, 'Received DOMAIN_EVENT_EMITTED with unexpected payload structure'); // Unknown event type
          // Check if event has a 'type' property before accessing it
          const subtype = typeof event === 'object' && event !== null && 'type' in event ? (event as { type: string }).type : 'unknown_subtype';
          logger.warn({ eventType, eventSubtype: subtype }, 'Received unknown domain event type'); user-friendly way.
 * 
 * Unlike the CLI module which handles command-line arguments and configuration,
 * this module focuses on real-time interactive display during the execution.
 */

import { 
  intro, 
  log,
  spinner, 
  confirm, 
  isCancel, 
  cancel,
  select
} from '@clack/prompts';
import chalk from 'chalk';
import { 
  bus
} from '../../app/bus/index.js';
import type { CliConfig, DomainEvent } from '../../app/model/index.js';
import { getLogger } from '../../infra/logging/index.js';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import { handleInitConfigEvent } from './init-info/index.js';
import {
  injectTuiDeps as injectEventListenerDeps,
  setupActualEventListeners
} from './event-listeners/index.js';
import {
  handleFileViewedEvent,
  handleFileEditedEvent,
  handleFileCreatedEvent,
  handleBackupCreatedEvent,
  handleErrorRaisedEvent
} from './domain-handlers/index.js';

// Logger will be initialized when needed
let logger = getLogger('tui');

// Active spinner instance
let activeSpinner: ReturnType<typeof spinner> | null = null;

// --- START: Refactored TUI Initialization Event Handling ---
// Removed displayInitialInfo, logLoadedConfigFile, requestUserConfirmation, and old handleInitConfigEvent
// --- END: Refactored TUI Initialization Event Handling ---

// --- START: Refactored Domain Event Handling ---
// Removed individual domain event handlers (handleFileViewedEvent, etc.)

/**
 * Dispatches domain events to their specific handlers.
 * @param busEventType The type of the bus event (e.g., BusEventType.DOMAIN_EVENT_EMITTED from BusNamespace.DOMAIN)
 * @param domainEvent The actual DomainEvent payload.
 */
function dispatchDomainEvent(busEventType: string, domainEvent: DomainEvent): void {
  if (!process.stdout.isTTY) return;
  switch (domainEvent.type) {
    case 'FileViewed':
      handleFileViewedEvent(domainEvent, activeSpinner);
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
      handleErrorRaisedEvent(domainEvent, activeSpinner);
      activeSpinner = null; // Ensure spinner is reset after error
      break;
    default: {
      const _exhaustiveCheck: never = domainEvent;
      logger.warn({ busEventType, eventSubtype: (_exhaustiveCheck as DomainEvent).type }, 'Received unhandled domain event subtype in dispatchDomainEvent');
    }
  }
}
// --- END: Refactored Domain Event Handling ---

// Moved isTUIEnvironment and initTUI before the self-initialization block
// to ensure they are defined before being called.
/**
 * Check if the current environment is suitable for TUI
 * 
 * @returns boolean indicating if TUI should be used
 */
export function isTUIEnvironment(): boolean {
  const isTTY = process.stdout.isTTY;
  const isCI = process.env.CI === 'true' || 
               !!process.env.GITHUB_ACTIONS || 
               !!process.env.GITLAB_CI || 
               !!process.env.JENKINS_URL;
  return isTTY && !isCI;
}

/**
 * Initialize the TUI module
 * 
 * @param config - CLI configuration
 */
export function initTUI(config: CliConfig): void {
  logger = getLogger('tui', config);
  logger.info('TUI initialized');
  if (process.env.NODE_ENV === 'development') {
    bus.setDebugMode(true);
  }
  // Inject dependencies into the event-listeners module
  injectEventListenerDeps({
    logger,
    activeSpinner,
    dispatchDomainEvent,
    handleInitConfigEvent, // Type should now be compatible
    getVersion,
    fs,
    fsSync
  });
  // Call the new setup function from the event-listeners module
  setupActualEventListeners(bus);
}

/**
 * Show a confirmation dialog
 * 
 * @param message - Message to display
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
export async function showConfirmation(message: string): Promise<boolean> {
  if (!process.stdout.isTTY) return true; // Auto-confirm if not in TTY
  
  const confirmed = await confirm({
    message
  });
  
  if (isCancel(confirmed) || !confirmed) {
    cancel('Operation cancelled.');
    return false;
  }
  
  return true;
}

/**
 * Create and return a spinner
 * 
 * @param message - Initial message for the spinner
 * @returns Spinner instance
 */
export function createSpinner(message: string) {
  if (!process.stdout.isTTY) return null; // No spinner if not in TTY
  
  // Stop any existing spinner
  if (activeSpinner) {
    activeSpinner.stop();
  }
  
  activeSpinner = spinner();
  activeSpinner.start(message);
  return activeSpinner;
}

/**
 * Clean up the TUI (remove event listeners)
 */
export function cleanupTUI(): void {
  // Stop any active spinner
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
  
  // No need to remove individual listeners, just clear all
  bus.clearAllListeners();
  logger.info('TUI cleaned up');
}

/**
 * Get the current version from package.json
 * 
 * @returns Version string
 */
function getVersion(): string {
  try {
    // This is a simplified version - in a real implementation, we would read from package.json
    return '0.2.0';
  } catch (error) {
    logger.error({ error }, 'Failed to read version from package.json');
    return '0.0.0';
  }
}

/**
 * Show a confirmation dialog for applying changes
 * 
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
export async function confirmApplyChanges(): Promise<boolean> {
  if (!process.stdout.isTTY) return true; // Auto-confirm if not in TTY
  
  const confirmed = await select({
    message: 'Apply these changes?',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'Abort' }
    ]
  });
  
  if (isCancel(confirmed) || !confirmed) {
    cancel('Operation cancelled.');
    return false;
  }
  
  return true;
}

/**
 * Show a confirmation dialog with config information in a styled format
 * 
 * @param specPath - Path to the spec file
 * @param configPath - Path to the loaded config file
 * @returns Promise that resolves to true if confirmed, false otherwise
 */
export async function showConfigConfirmation(specPath: string, configPath?: string): Promise<boolean> {
  if (!process.stdout.isTTY) return true; // Auto-confirm if not in TTY
  
  intro(`cedit v${getVersion()}`);
  
  if (configPath) {
    log.step('Loaded config');
    log.message(configPath);
  }
  
  const result = await confirm({
    message: `Run cedit with spec "${specPath}"?`
  });
  
  if (isCancel(result) || !result) {
    cancel('Operation cancelled.');
    return false;
  }
  
  return true;
}

/**
 * Start the LLM processing spinner
 * 
 * @returns Spinner instance
 */
export function startLLMProcessing(): ReturnType<typeof spinner> | null {
  return createSpinner('Sending to Claude...');
}

// Self-initialize the TUI module when imported, but only if in a suitable environment
// This is done outside of any function to ensure it runs when the module is imported
// Skip initialization in test environments
if (isTUIEnvironment() && process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  // We'll receive the actual config via the bus INIT_CONFIG event
  // Provide a minimal partial config for the initial call to satisfy types.
  // getLogger can handle partial config for initial setup.
  initTUI({ log: { level: 'info', dir: '' } } as Partial<CliConfig> as CliConfig);
}

/**
 * Update the spinner with a domain event
 * 
 * @param event - Domain event
 */
export function updateSpinnerWithEvent(event: DomainEvent): void {
  if (!activeSpinner || !process.stdout.isTTY) return;
  
  switch (event.type) {
    case 'FileViewed':
      activeSpinner.message(`Viewing ${chalk.cyan(event.path)}...`);
      break;
    case 'FileEdited':
      activeSpinner.message(`Editing ${chalk.cyan(event.path)}...`);
      break;
    case 'FileCreated':
      activeSpinner.message(`Creating ${chalk.cyan(event.path)}...`);
      break;
    case 'BackupCreated':
      activeSpinner.message(`Creating backup for ${chalk.cyan(event.originalPath)}...`);
      break;
    case 'ErrorRaised':
      activeSpinner.message(`Error: ${chalk.red(event.message)}`);
      break;
  }
}

/**
 * Handle a domain event
 * 
 * @param eventType - Type of the event
 * @param event - Domain event object
 */
export function handleDomainEvent(eventType: string, event: DomainEvent): void {
  // Handle different event types
  switch (event.type) {
    case 'FileViewed':
      handleFileViewedEvent(event, activeSpinner);
      break;
    case 'FileEdited':
      handleFileEditedEvent(event);
      break;
    case 'FileCreated':
      handleFileCreatedEvent(event);
      break;
    case 'BackupCreated':
      handleBackupCreatedEvent(event);
      break;
    case 'ErrorRaised':
      handleErrorRaisedEvent(event, activeSpinner);
      activeSpinner = null; // Ensure spinner is reset after error
      break;
    default: {
      // event is 'never' here due to exhaustive switch.
      // We access the original event type from the payload.
      // The following lines referencing 'payload' are removed as 'payload' is not in scope here.
      // This part of the logic needs to be re-evaluated if unhandled domain events are expected
      // and need specific logging from this point. For now, the dispatchDomainEvent handles unknown subtypes.
      logger.warn({ busEventType: eventType /* payload is not in scope here */ }, 'Received DOMAIN_EVENT_EMITTED with unknown event structure in default case of handleDomainEvent');
    }
  }
}