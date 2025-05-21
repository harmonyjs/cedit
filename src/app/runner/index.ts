/**
 * Runner service for cedit CLI tool
 * 
 * This module orchestrates the full end-to-end flow: load configuration, parse the spec YAML,
 * feed it to the LLM stream, hand each ToolUse to app/editor, collect DomainEvents,
 * and return a summary for the CLI/TUI.
 * 
 * It serves as the central "brain" that glues LLM → Editor → Events together.
 */

import * as fs from 'node:fs/promises';
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

/**
 * Processes the LLM prompt stream, handling each ToolUse and collecting events.
 * Extracted from run() to reduce function size and improve modularity.
 *
 * @param llm - The LLM instance
 * @param finalSpec - The interpolated spec
 * @param cfg - CLI configuration
 * @param log - Logger instance
 * @param events - Array to collect DomainEvents
 */
interface ProcessLLMStreamParams {
  llm: ReturnType<typeof createLLM>;
  finalSpec: Spec;
  cfg: CliConfig;
  log: ReturnType<typeof getLogger>;
  events: DomainEvent[];
}

/**
 * Processes the LLM prompt stream, handling each ToolUse and collecting events.
 * Accepts a single parameter object to comply with max-params lint rule.
 */
async function processLLMStream({ llm, finalSpec, cfg, log, events }: ProcessLLMStreamParams): Promise<void> {
  log.info('[DEBUG] Starting LLM prompt stream processing...');
  let toolUseCounter = 0;
  for await (const toolUse of llm.sendPrompt(finalSpec)) {
    toolUseCounter++;
    log.info({ toolUseId: toolUse.command.id, kind: toolUse.command.kind, count: toolUseCounter }, '[DEBUG] Processing tool use');
    const event = await handleToolUse(toolUse, cfg);
    emitDomainEvent(event);
    events.push(event);
    if (event.type === 'ErrorRaised' /* && isCriticalError(event) */) {
      log.error({ event }, '[DEBUG] Critical error encountered, stopping run.');
      // break; // Uncomment to stop on first error
    }
  }
  log.info(`[DEBUG] Finished processing LLM stream. ${toolUseCounter} tool uses received.`);
}

export async function run(specPath: string, cfg: CliConfig): Promise<void> {
  const log = getLogger('runner', cfg);
  log.info({ specPath, dryRun: cfg.dryRun, model: cfg.model }, '[DEBUG] Runner starting execution');
  emitInitConfig(cfg);
  const events: DomainEvent[] = [];
  let finalSpec: Spec;
  const startTime = Date.now();
  try {
    console.log('[DEBUG] Runner: loading spec');
    const spec = await loadSpec(specPath);
    console.log('[DEBUG] Runner: spec loaded');
    finalSpec = interpolate(spec, cfg);
    log.info('[DEBUG] Spec variables interpolated');
    const llm = createLLM(cfg);
    log.info('[DEBUG] LLM service created');
    await processLLMStream({ llm, finalSpec, cfg, log, events });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error({ error: errorMessage, stack: errorStack }, '[DEBUG] Unhandled error during runner execution');
    const errorEvent: ErrorRaised = { type: 'ErrorRaised', message: `[DEBUG] Runner failed: ${errorMessage}` };
    emitDomainEvent(errorEvent);
    events.push(errorEvent);
    emitFinishAbort(`[DEBUG] Runner failed: ${errorMessage}`);
    aggregate(events);
  }
  const summary = aggregate(events);
  log.info({ stats: summary.stats, errors: summary.errors.length, events: events.length }, '[DEBUG] Run completed');
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
}