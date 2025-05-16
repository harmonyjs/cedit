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
  outro, 
  log, 
  spinner, 
  confirm, 
  isCancel, 
  cancel,
  text,
  select,
  note
} from '@clack/prompts';
import chalk from 'chalk';
import { 
  bus, 
  BusEventType, 
  BusNamespace 
} from '../../app/bus/index.js';
import type { CliConfig, DomainEvent } from '../../app/model/index.js';
import { getLogger } from '../../infra/logging/index.js';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';

// Logger will be initialized when needed
let logger = getLogger('tui');

// Active spinner instance
let activeSpinner: ReturnType<typeof spinner> | null = null;

// --- START: Refactored TUI Initialization Event Handling ---
/**
 * Displays initial TUI elements like intro, model info, and dry run warning.
 */
function displayInitialInfo(config: CliConfig): void {
  if (!process.stdout.isTTY) return;

  process.stdout.write('\x1Bc'); // Clear screen
  intro(`cedit v${getVersion()}`);
  log.info(`Using model: ${chalk.cyan(config.model)}`);
  if (config.dry_run) {
    log.warn(chalk.yellow('DRY RUN MODE - No files will be modified'));
  }
}

/**
 * Tries to find and log the path of the loaded configuration file.
 */
async function logLoadedConfigFile(): Promise<void> {
  if (!process.stdout.isTTY) return;
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
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

/**
 * Prompts the user for confirmation to proceed with the cedit operation.
 * Emits INIT_COMPLETE event with the user's decision.
 */
async function requestUserConfirmation(): Promise<void> {
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

/**
 * Handles the INIT_CONFIG event by orchestrating display and confirmation.
 */
async function handleInitConfigEvent(payload: { config: CliConfig }): Promise<void> {
  const { config } = payload;
  logger.info({ config }, 'Received init config event');

  displayInitialInfo(config);
  await logLoadedConfigFile();
  await requestUserConfirmation();
}
// --- END: Refactored TUI Initialization Event Handling ---

// --- START: Refactored Domain Event Handling ---
function handleFileViewedEvent(event: Extract<DomainEvent, { type: 'FileViewed' }>): void {
  if (!process.stdout.isTTY) return;
  if (activeSpinner) {
    activeSpinner.stop(`Viewed ${chalk.cyan(event.path)}`);
    activeSpinner = null;
  } else {
    log.info(`Viewed ${chalk.cyan(event.path)} (${event.lines} lines)`);
  }
}

function handleFileEditedEvent(event: Extract<DomainEvent, { type: 'FileEdited' }>): void {
  if (!process.stdout.isTTY) return;
  if (event.stats) {
    const { added, removed, changed } = event.stats;
    log.success(`Edited ${chalk.cyan(event.path)}: ${chalk.green(`+${added}`)} ${chalk.red(`-${removed}`)} ${chalk.yellow(`~${changed}`)}`);
  } else {
    log.success(`Edited ${chalk.cyan(event.path)}`);
  }
}

function handleFileCreatedEvent(event: Extract<DomainEvent, { type: 'FileCreated' }>): void {
  if (!process.stdout.isTTY) return;
  log.success(`Created ${chalk.cyan(event.path)} (${event.lines} lines)`);
}

function handleBackupCreatedEvent(event: Extract<DomainEvent, { type: 'BackupCreated' }>): void {
  if (!process.stdout.isTTY) return;
  log.info(`Backup created: ${chalk.gray(event.originalPath)} → ${chalk.gray(event.backupPath)}`);
}

function handleErrorRaisedEvent(event: Extract<DomainEvent, { type: 'ErrorRaised' }>): void {
  if (!process.stdout.isTTY) return;
  if (activeSpinner) {
    activeSpinner.stop(chalk.red(`Error: ${event.message}`));
    activeSpinner = null;
  } else {
    log.error(`Error: ${chalk.red(event.message)}`);
  }
}

/**
 * Dispatches domain events to their specific handlers.
 * @param busEventType The type of the bus event (e.g., BusEventType.DOMAIN_EVENT_EMITTED from BusNamespace.DOMAIN)
 * @param domainEvent The actual DomainEvent payload.
 */
function dispatchDomainEvent(busEventType: string, domainEvent: DomainEvent): void {
  if (!process.stdout.isTTY) return;
  switch (domainEvent.type) {
    case 'FileViewed':
      handleFileViewedEvent(domainEvent);
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
      handleErrorRaisedEvent(domainEvent);
      break;
    default:
      const _exhaustiveCheck: never = domainEvent;
      logger.warn({ busEventType, eventSubtype: (_exhaustiveCheck as DomainEvent).type }, 'Received unhandled domain event subtype in dispatchDomainEvent');
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
  setupEventListeners(); // Call to setup listeners
}

/**
 * Set up event listeners for the Event Bus
 */
function setupEventListeners(): void {
  // Listen for init events
  bus.onTyped(BusEventType.INIT_CONFIG, (payload) => {
    handleInitConfigEvent(payload).catch((error: unknown) => {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in handleInitConfigEvent');
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
    
    if (payload && typeof payload === 'object' && 'event' in payload) {
      const domainEvent = (payload as { event: DomainEvent }).event;
      if (domainEvent && typeof domainEvent === 'object' && 'type' in domainEvent) {
        dispatchDomainEvent(String(busEventType), domainEvent);
      } else {
        logger.warn({ busEventType: String(busEventType), payloadType: typeof payload, eventContent: domainEvent }, 'Received DOMAIN_EVENT_EMITTED with invalid event content in payload');
      }
    } else {
      logger.warn({ busEventType: String(busEventType), payloadType: typeof payload }, 'Received DOMAIN_EVENT_EMITTED with unexpected payload structure (missing event property)');
    }
  });
  
  // Listen for finish events
  bus.onTyped(BusEventType.FINISH_SUMMARY, (payload) => {
    if (!process.stdout.isTTY) return; // Skip if not in TTY
    
    // Stop any active spinner
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
    
    // Show tip for dry run mode
    if (filesEdited > 0 || filesCreated > 0) {
      note(
        `Tip: open files above to review; rerun with --dry-run anytime`,
        'Next Steps'
      );
    }
    
    outro(chalk.green('✨ All done! ✨'));
  });
  
  bus.onTyped(BusEventType.FINISH_ABORT, (payload) => {
    if (!process.stdout.isTTY) return; // Skip if not in TTY
    
    // Stop any active spinner
    if (activeSpinner) {
      activeSpinner.stop(chalk.red(`Aborted: ${payload.reason}`));
      activeSpinner = null;
    } else {
      log.error(`Aborted: ${chalk.red(payload.reason)}`);
    }
    
    if (payload.code) {
      log.info(`Code: ${chalk.gray(payload.code)}`);
    }
    
    outro(chalk.red('Operation aborted'));
  });
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
 * Interactive TUI flow for gathering user input
 * 
 * @returns Object containing user input or null if cancelled
 */
export async function gatherUserInput(): Promise<{
  specPath: string;
  variables: Record<string, string>;
  dryRun: boolean;
} | null> {
  if (!process.stdout.isTTY) {
    logger.info('Not in TTY environment, skipping interactive input');
    return null;
  }
  
  intro(chalk.inverse(` cedit v${getVersion()} ─ interactive CLI `));
  
  // Ask for spec file
  const specPath = await text({
    message: 'Spec file to run?',
    validate: (value) => {
      if (!value) return 'Please enter a spec file path';
      
      try {
        // Synchronous check - not ideal but works for validation
        fsSync.accessSync(value);
        return undefined; // No error
      } catch (_error) {
        return `File not found: ${value}`;
      }
    }
  });
  
  if (isCancel(specPath)) {
    cancel('Operation cancelled.');
    return null;
  }
  
  // Ask for variables
  const variables: Record<string, string> = {};
  let continueVars = true;
  
  log.step('Override variables (key=value, blank to finish)');
  
  while (continueVars) {
    const varInput = await text({
      message: 'Variable (key=value)',
      placeholder: 'e.g. output_path=./result.md',
    });
    
    if (isCancel(varInput)) {
      cancel('Operation cancelled.');
      return null;
    }
    
    if (!varInput) {
      continueVars = false;
    } else {
      const parts = varInput.split('=');
      if (parts.length === 2) {
        variables[parts[0].trim()] = parts[1].trim();
      } else {
        log.warn('Invalid format. Use key=value');
      }
    }
  }
  
  // Ask for dry run
  const dryRun = await select({
    message: 'Dry‑run first?',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' }
    ]
  });
  
  if (isCancel(dryRun)) {
    cancel('Operation cancelled.');
    return null;
  }
  
  return {
    specPath: specPath,
    variables,
    dryRun: dryRun
  };
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
      handleFileViewedEvent(event);
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
      handleErrorRaisedEvent(event);
      break;
    default:
      // event is 'never' here due to exhaustive switch.
      // We access the original event type from the payload.
      // The following lines referencing 'payload' are removed as 'payload' is not in scope here.
      // This part of the logic needs to be re-evaluated if unhandled domain events are expected
      // and need specific logging from this point. For now, the dispatchDomainEvent handles unknown subtypes.
      logger.warn({ busEventType: eventType /* payload is not in scope here */ }, 'Received DOMAIN_EVENT_EMITTED with unknown event structure in default case of handleDomainEvent');
  }
}