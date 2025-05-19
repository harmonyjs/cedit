/**
 * Domain Model for cedit CLI tool
 * 
 * This file contains the core domain types and interfaces that represent:
 * 1. The YAML specification structure
 * 2. Prompts and variables
 * 3. File attachments
 * 4. Tool commands and events
 * 5. Configuration options
 * 
 * These types form the foundation of the application and are used across all layers.
 */

// ======================================================================
// YAML Specification Structure
// ======================================================================

/**
 * Represents the YAML specification structure that defines the prompts,
 * variables, and optional file attachments.
 */
export interface Spec {
  /** System prompt that sets the context for Claude */
  system: string;
  
  /** User prompt that contains the specific instructions */
  user: string;
  
  /** Template variables that can be referenced in the prompts */
  variables: Record<string, string>;
  
  /** Optional list of file paths to attach to the prompt */
  attachments?: string[];
}

// ======================================================================
// Tool Commands
// ======================================================================

/**
 * Base interface for all tool commands
 */
export interface ToolCommandBase {
  /** Unique identifier for the command */
  id: string;
  
  /** File path that the command operates on */
  path: string;
  
  /** Type of command */
  kind: string;
}

/**
 * Command to view the contents of a file
 * Used by Claude to request file content
 */
export interface ViewCommand extends ToolCommandBase {
  kind: 'view';
}

/**
 * Command to insert content at a specific position in a file
 */
export interface InsertCommand extends ToolCommandBase {
  kind: 'insert';
  
  /** Line number after which to insert content (0-based) */
  after: number;
  
  /** Content to insert */
  content: string;
}

/**
 * Command to replace content in a file between specific lines
 */
export interface ReplaceCommand extends ToolCommandBase {
  kind: 'str_replace';
  
  /** Starting line number for replacement (0-based) */
  lineFrom: number;
  
  /** Ending line number for replacement (0-based) */
  lineTo: number;
  
  /** New content to replace the specified lines */
  content: string;
}

/**
 * Command to create a new file with specified content
 */
export interface CreateCommand extends ToolCommandBase {
  kind: 'create';
  
  /** Content for the new file */
  content: string;
}

/**
 * Command to undo the last edit operation
 */
export interface UndoEditCommand extends ToolCommandBase {
  kind: 'undo_edit';
}

/**
 * Union type of all possible tool commands
 */
export type ToolCommand = 
  | ViewCommand 
  | InsertCommand 
  | ReplaceCommand 
  | CreateCommand 
  | UndoEditCommand;

// ======================================================================
// Domain Events
// ======================================================================

/**
 * Base interface for all domain events
 */
export interface DomainEventBase {
  /** Type of the event */
  type: string;
}

/**
 * Event emitted when a file is viewed
 */
export interface FileViewed extends DomainEventBase {
  type: 'FileViewed';
  
  /** Path of the viewed file */
  path: string;
  
  /** Number of lines in the file */
  lines: number;
}

/**
 * Event emitted when a file is edited
 */
export interface FileEdited extends DomainEventBase {
  type: 'FileEdited';
  
  /** Path of the edited file */
  path: string;
  
  /** Number of lines affected */
  lines: number;
  
  /** Statistics about the edit */
  stats?: EditStats;
}

/**
 * Event emitted when a file is created
 */
export interface FileCreated extends DomainEventBase {
  type: 'FileCreated';
  
  /** Path of the created file */
  path: string;
  
  /** Number of lines in the created file */
  lines: number;
}

/**
 * Event emitted when a backup is created
 */
export interface BackupCreated extends DomainEventBase {
  type: 'BackupCreated';
  
  /** Original file path */
  originalPath: string;
  
  /** Backup file path */
  backupPath: string;
}

/**
 * Event emitted when an error occurs
 */
export interface ErrorRaised extends DomainEventBase {
  type: 'ErrorRaised';
  
  /** Error message */
  message: string;
  
  /** Optional error code */
  code?: string;
}

/**
 * Union type of all possible domain events
 */
export type DomainEvent = 
  | FileViewed 
  | FileEdited 
  | FileCreated 
  | BackupCreated 
  | ErrorRaised;

// ======================================================================
// Statistics
// ======================================================================

/**
 * Statistics about file edits
 */
export interface EditStats {
  /** Number of lines added */
  added: number;
  
  /** Number of lines removed */
  removed: number;
  
  /** Number of lines changed */
  changed: number;
}
// ======================================================================
// Configuration
// ======================================================================

/**
 * Log configuration options
 */
export interface LogConfig {
  /** Log level (info, error) */
  level: 'info' | 'error';
  
  /** Directory to store log files */
  dir: string;
}

/**
 * Backup configuration options
 */
export interface BackupConfig {
  /** Directory to store backup files */
  dir: string;
  
  /** Number of days to keep backups (0 = keep forever) */
  keepForDays: number;
}

/**
 * Default configuration options
 */
export interface DefaultConfig {
  /** Default dry run setting */
  dryRun: boolean;
  
  /** Default maximum tokens */
  maxTokens: number;

  /** Claude model to use */
  model: string;
  
  /** Number of retries for API calls */
  retries: number;
  
  /** Milliseconds to sleep between API requests */
  sleepBetweenRequestsMs: number;
}

/**
 * CLI configuration options
 */
export interface CliConfig {
  /** Anthropic API key */
  anthropicApiKey: string;
  
  /** Claude model to use */
  model: string;
  
  /** Number of retries for API calls */
  retries: number;
  
  /** Milliseconds to sleep between API requests */
  sleepBetweenRequestsMs: number;
  
  /** Log configuration */
  log: LogConfig;
  
  /** Backup configuration */
  backup: BackupConfig;
  
  /** Default configuration */
  defaults: DefaultConfig;
  
  /** Whether to run in dry run mode */
  dryRun?: boolean;
  
  /** Maximum tokens for the request */
  maxTokens?: number;

  /** Variable overrides from the command line */
  varsOverride: Record<string, string>;
}

// ======================================================================
// Tool Use
// ======================================================================

/**
 * Represents a tool use from Claude
 */
export interface ToolUse {
  /** The name of the tool */
  name: string;
  
  /** The type of the tool */
  type: string;
  
  /** The command to execute */
  command: ToolCommand;
}

/**
 * Represents a message to Claude
 */
export interface ClaudeMessage {
  /** The role of the message sender */
  role: 'user' | 'assistant' | 'system';
  
  /** The content of the message */
  content: string;
}
