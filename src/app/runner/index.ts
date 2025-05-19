/**
 * Runner service for cedit CLI tool
 * 
 * This module orchestrates the full end-to-end flow: load configuration, parse the spec YAML,
 * feed it to the LLM stream, hand each ToolUse to app/editor, collect DomainEvents,
 * and return a summary for the CLI/TUI.
 * 
 * It serves as the central "brain" that glues LLM → Editor → Events together.
 */

import fs from 'node:fs/promises';
import yaml from 'yaml';
import type {
  Spec,
  CliConfig,
  DomainEvent,
  ErrorRaised
} from '../model/index.js';
import { createLLM } from '../../infra/llm/index.js';
import { handleToolUse } from '../editor/index.js';
import { getLogger } from '../../infra/logging/index.js';
import {
  emitInitConfig,
  emitDomainEvent,
  emitFinishSummary,
  emitFinishAbort
} from '../bus/index.js';

/**
 * Loads and parses a YAML spec file
 * 
 * @param path - Path to the spec file
 * @returns Parsed spec object
 */
async function loadSpec(path: string): Promise<Spec> {
  const log = getLogger('runner');
  log.info({ path }, 'Loading spec file');
  const raw = await fs.readFile(path, 'utf8');
  const doc: unknown = yaml.parse(raw);
  // Add more robust validation based on Spec type definition
  if (doc === null || typeof doc !== 'object' || !('system' in doc) || !('user' in doc) || !('variables' in doc)) { // Added null check
    throw new Error(`Invalid spec file (${path}): missing required fields (system, user, variables)`);
  }
  // Potentially validate attachments array if present
  if ('attachments' in doc && doc.attachments !== null && !Array.isArray(doc.attachments)) {
     throw new Error(`Invalid spec file (${path}): attachments must be an array`);
  }
  log.info({ path }, 'Spec file loaded and parsed successfully');
  return doc as Spec;
}

/**
 * Summary of the execution results
 */
export interface Summary {
  /** All events that occurred during execution */
  events: DomainEvent[];
  
  /** Statistics about file changes */
  stats: { added: number; removed: number; changed: number };
  
  /** Errors that occurred during execution */
  errors: ErrorRaised[];
  
  /** Number of commands processed */
  commandsProcessed: number;
}

/**
 * Aggregates events into a summary
 * 
 * @param events - Domain events to aggregate
 * @returns Summary of the events
 */
function aggregate(events: DomainEvent[]): Summary {
  let added = 0, removed = 0, changed = 0;
  const errors: ErrorRaised[] = [];
  let commandsProcessed = 0;

  for (const e of events) {
    commandsProcessed++;
    if (e.type === 'FileEdited') {
      const fileEdited = e;
      if (fileEdited.stats) {
        added += fileEdited.stats.added;
        removed += fileEdited.stats.removed;
        changed += fileEdited.stats.changed;
      }
    } else if (e.type === 'FileViewed') {
      // View doesn't change stats
    } else if (e.type === 'ErrorRaised') {
      errors.push(e);
      // Decide if an error event still counts as a processed command
      // commandsProcessed--; // Optional: Decrement if errors shouldn't count
    }
    // Handle other event types if added
  }
  return { events, stats: { added, removed, changed }, errors, commandsProcessed };
}

/**
 * Interpolates variables in the spec
 * 
 * @param spec - The spec to interpolate
 * @param cfg - CLI configuration with potential variable overrides
 * @returns Interpolated spec
 */
function interpolate(spec: Spec, cfg: CliConfig): Spec {
  let sys = spec.system;
  let usr = spec.user;
  const vars = { ...spec.variables }; // clone

  // Check if CLI overrides exist
  type ExtendedCliConfig = CliConfig & { varsOverride?: Record<string, string> };
  const overrides = (cfg as ExtendedCliConfig).varsOverride;
  if (typeof overrides !== 'undefined' && overrides !== null && typeof overrides === 'object') { // Added null and undefined checks
      getLogger('runner').info({ count: Object.keys(overrides).length }, 'Applying CLI variable overrides');
      Object.assign(vars, overrides);
  }

  getLogger('runner').info({ count: Object.keys(vars).length }, 'Interpolating variables');
  for (const [k, v] of Object.entries(vars)) {
    // Basic placeholder replacement
    const placeholder = `{{var.${k}}}`;
    // Use regex for global replacement
    const regex = new RegExp(placeholder.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    sys = sys.replace(regex, v);
    usr = usr.replace(regex, v);
  }
  // TODO: Interpolate variables within attachments if needed
  return { ...spec, system: sys, user: usr, variables: vars };
}

/**
 * Main function that orchestrates the entire process
 * 
 * @param specPath - Path to the spec file
 * @param cfg - CLI configuration
 * @returns Summary of the execution
 */
export async function run(specPath: string, cfg: CliConfig): Promise<void> {
  // Initialize logger here, now that we have config
  const log = getLogger('runner', cfg);
  log.info({ specPath, dryRun: cfg.dryRun, model: cfg.model }, 'Runner starting execution'); // Corrected cfg.dry_run to cfg.dryRun

  // Emit init config event
  emitInitConfig(cfg);

  const events: DomainEvent[] = [];
  let finalSpec: Spec;
  const startTime = Date.now();

  try {
    // 1. Load spec
    const spec = await loadSpec(specPath);

    // 2. Interpolate variables with CLI overrides
    finalSpec = interpolate(spec, cfg);
    log.info('Spec variables interpolated');

    // 3. Create LLM instance
    const llm = createLLM(cfg);
    log.info('LLM service created');

    // 4. Stream ToolUse -> editor
    log.info('Starting LLM prompt stream processing...');
    let toolUseCounter = 0;
    for await (const toolUse of llm.sendPrompt(finalSpec)) {
      toolUseCounter++;
      log.info({ toolUseId: toolUse.command.id, kind: toolUse.command.kind, count: toolUseCounter }, 'Processing tool use');
      const event = await handleToolUse(toolUse, cfg);
      
      // Emit domain event through the bus
      emitDomainEvent(event);
      
      // Also collect for summary
      events.push(event);
      
      // Optional: Add logic to stop early if a critical ErrorRaised event occurs
      if (event.type === 'ErrorRaised' /* && isCriticalError(event) */) {
         log.error({ event }, 'Critical error encountered, stopping run.');
         // break; // Uncomment to stop on first error
      }
    }
    log.info(`Finished processing LLM stream. ${toolUseCounter} tool uses received.`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error({ error: errorMessage, stack: errorStack }, 'Unhandled error during runner execution');
    // Ensure critical errors during setup (loadSpec, interpolate, createLLM) are captured 
    const errorEvent: ErrorRaised = { type: 'ErrorRaised', message: `Runner failed: ${errorMessage}` }; // Explicit type
    
    // Emit error event through the bus
    emitDomainEvent(errorEvent);
    
    // Also collect for summary
    events.push(errorEvent);
    
    // Emit abort event
    emitFinishAbort(`Runner failed: ${errorMessage}`);
    
    // Aggregate events for the abort summary - not using the summary since we're just emitting the abort event
    aggregate(events);
    // No return needed as we're now using void
  }

  // 5. Aggregate and return
  const summary = aggregate(events);
  log.info({ stats: summary.stats, errors: summary.errors.length, events: events.length }, 'Run completed');
  
  // Emit finish summary event
  const duration = Date.now() - startTime;
  emitFinishSummary({
    filesEdited: events.filter(e => e.type === 'FileEdited').length,
    filesCreated: events.filter(e => e.type === 'FileCreated').length,
    backupsCreated: events.filter(e => e.type === 'BackupCreated').length,
    totalEdits: {
      added: summary.stats.added,
      removed: summary.stats.removed,
      changed: summary.stats.changed
    }
  }, duration);
  
  // No return needed as we're now using void
}