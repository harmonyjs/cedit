/**
 * Type-safe CLI interfaces derived from the centralized registry.
 * These types are automatically kept in sync with CLI_OPTION_REGISTRY.
 */

/**
 * Interface for CLI flags used internally throughout the application.
 * This reflects our internal property names and types.
 */
export interface CliFlags {
  spec: string;
  configPath?: string;
  dryRun: boolean | undefined;
  var: string[];
  logLevel: string | undefined;
  logDir: string;
  backupDir: string;
  maxTokens: number;
  model: string;
  retries: number;
  sleepMs: number;
  yes: boolean;
}

/**
 * Interface for values provided by Commander.js.
 * This reflects what Commander.js actually gives us in the opts object.
 */
export interface CommanderOptionValues {
  config?: string;
  dryRun?: boolean;
  var?: string[];
  logLevel?: string;
  logDir?: string;
  backupDir?: string;
  maxTokens?: number;
  model?: string;
  retries?: number;
  sleepMs?: number;
  yes?: boolean;
}
