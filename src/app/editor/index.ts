/**
 * Editor service for cedit CLI tool
 * 
 * This module consumes ToolUse commands streamed from infra/llm and applies them
 * with infra/storage, emitting DomainEvent objects for the rest of the app.
 * 
 * It serves as a single command handler that turns low-level ToolUse objects into
 * concrete filesystem edits, decoupling LLM streaming from storage logic.
 */

import type {
  ToolUse,
  ReplaceCommand as ReplaceUse,
  InsertCommand as InsertUse,
  ViewCommand as ViewUse,
  CreateCommand as CreateUse,
  UndoEditCommand as UndoUse,
  DomainEvent,
  FileViewed,
  FileEdited,
  ErrorRaised,
  CliConfig,
} from '../model/index.js';
import * as Storage from '../../infra/storage/index.js';
import { getLogger } from '../../infra/logging/index.js';
import path from 'node:path';
import os from 'node:os';
import { emitDomainEvent } from '../bus/index.js';

// Create a minimal default logger configuration
const DEFAULT_LOG_CONFIG: CliConfig = {
  anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-sonnet-20240229',
  retries: 3,
  sleep_between_requests_ms: 1000,
  log: {
    level: 'info' as const,
    dir: path.join(os.tmpdir(), 'cedit', 'logs'),
  },
  backup: {
    dir: path.join(os.tmpdir(), 'cedit', 'backups'),
    keep_for_days: 0,
  },
  defaults: {
    dry_run: false,
    max_tokens: 200000,
    model: 'claude-3-sonnet-20240229', // Ensured
    retries: 3, // Ensured
    sleep_between_requests_ms: 1000, // Ensured
  },
  dry_run: false,
  max_tokens: 200000,
  varsOverride: {},
};

// Initialize logger with default config, will be updated in handleToolUse
let log = getLogger('editor', DEFAULT_LOG_CONFIG);

/**
 * Helper function to create error events with logging
 * 
 * @param msg - Error message
 * @param path - Optional file path related to the error
 * @returns An ErrorRaised domain event
 */
function error(msg: string, path?: string): ErrorRaised {
  log.error({ path }, msg);
  return { type: 'ErrorRaised', message: msg };
}

/**
 * Handle view command to read file contents
 * 
 * @param cmd - View command
 * @returns FileViewed event or ErrorRaised event
 */
async function handleView(cmd: ViewUse): Promise<FileViewed | ErrorRaised> {
  log.info({ path: cmd.path }, 'Handling view command');
  try {
    const lines = await Storage.readFileLines(cmd.path);
    // TODO: Implement line range filtering if cmd.lineFrom/lineTo are provided
    return {
      type: 'FileViewed',
      path: cmd.path,
      lines: lines.length
    }; // Return full content for now
  } catch (e: unknown) {
    return error(e instanceof Error ? e.message : String(e), cmd.path);
  }
}

/**
 * Handle replace command to replace content in a file
 * 
 * @param cmd - Replace command
 * @param cfg - CLI configuration
 * @returns FileEdited event or ErrorRaised event
 */
async function handleReplace(cmd: ReplaceUse, cfg: CliConfig): Promise<FileEdited | ErrorRaised> {
  log.info({ path: cmd.path, lineFrom: cmd.lineFrom, lineTo: cmd.lineTo }, 'Handling replace command');
  // Basic validation
  if (typeof cmd.lineFrom !== 'number' || typeof cmd.lineTo !== 'number' || typeof cmd.content !== 'string') {
    return error('Invalid str_replace command: missing required fields', cmd.path);
  }
  try {
    // Delegate directly to storage which handles backup and returns FileEdited event
    return await Storage.applyReplace(cmd, cfg);
  } catch (e: unknown) {
    return error(e instanceof Error ? e.message : String(e), cmd.path);
  }
}

/**
 * Handle insert command to insert content into a file
 * 
 * @param cmd - Insert command
 * @param cfg - CLI configuration
 * @returns FileEdited event or ErrorRaised event
 */
async function handleInsert(cmd: InsertUse, cfg: CliConfig): Promise<FileEdited | ErrorRaised> {
  log.info({ path: cmd.path, after: cmd.after }, 'Handling insert command');
  // Basic validation
  if (typeof cmd.after !== 'number' || typeof cmd.content !== 'string') {
    return error('Invalid insert command: missing required fields', cmd.path);
  }
  try {
    // Delegate directly to storage which handles backup and returns FileEdited event
    return await Storage.applyInsert(cmd, cfg);
  } catch (e: unknown) {
    return error(e instanceof Error ? e.message : String(e), cmd.path);
  }
}

/**
 * Handle create command to create a new file
 * 
 * @param cmd - Create command
 * @param cfg - CLI configuration
 * @returns FileEdited event or ErrorRaised event
 */
async function handleCreate(cmd: CreateUse, cfg: CliConfig): Promise<FileEdited | ErrorRaised> {
  log.info({ path: cmd.path }, 'Handling create command');
  // Basic validation
  if (typeof cmd.content !== 'string') {
    return error('Invalid create command: missing content field', cmd.path);
  }
  try {
    // Use storage.writeFile which handles dryRun
    // Note: storage.writeFile doesn't create backups for new files, which is correct.
    const lines = cmd.content.split(/\r?\n/);
    const lineCount = await Storage.writeFile(cmd.path, cmd.content, cfg);
    // Return a FileEdited event structure, as creation is a form of edit (0 lines removed, N added)
    return {
      type: 'FileEdited',
      path: cmd.path,
      lines: lineCount,
      stats: {
        added: lines.length,
        removed: 0,
        changed: 0
      }
    };
  } catch (e: unknown) {
    return error(e instanceof Error ? e.message : String(e), cmd.path);
  }
}

/**
 * Handle undo command (stub implementation for v1)
 * 
 * @param cmd - Undo command
 * @returns ErrorRaised event (not implemented yet)
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleUndo(cmd: UndoUse): Promise<ErrorRaised> {
  log.warn({ path: cmd.path }, 'Handling undo command (not implemented)');
  // For v1 we can reply error (needs future backup mapping)
  return error('undo_edit not implemented yet', cmd.path);
}

/**
 * Main dispatcher function that handles all tool use commands
 * 
 * @param cmd - Tool use command
 * @param cfg - CLI configuration
 * @returns Domain event based on the command result
 */
export async function handleToolUse(toolUse: ToolUse, cfg: CliConfig): Promise<DomainEvent> {
  // Initialize logger with config
  log = getLogger('editor', cfg);
  
  const cmd = toolUse.command;
  log.info({ toolUseId: cmd.id, kind: cmd.kind }, 'Dispatching tool use command');
  
  // Add validation for base fields required by all commands
  if (!cmd.kind || !cmd.path) {
    const errorEvent = error(`Invalid command received: missing kind or path. ID: ${cmd.id}`);
    // Emit the error event through the bus
    emitDomainEvent(errorEvent);
    return errorEvent;
  }

  let event: DomainEvent;
  
  switch (cmd.kind) {
    case 'view':
      event = await handleView(cmd);
      break;
    case 'str_replace':
      event = await handleReplace(cmd, cfg);
      break;
    case 'insert':
      event = await handleInsert(cmd, cfg);
      break;
    case 'create':
      event = await handleCreate(cmd, cfg);
      break;
    case 'undo_edit':
      event = await handleUndo(cmd);
      break;
    default:
      // Handle cases where 'kind' might be something unexpected
      const unknownCmd = cmd as { kind: string };
      log.error({ unknownKind: unknownCmd.kind }, 'Unsupported command kind received');
      event = error(`Unsupported command kind: ${unknownCmd.kind}`);
      break;
  }
  
  // Emit the domain event through the bus
  emitDomainEvent(event);
  
  return event;
}