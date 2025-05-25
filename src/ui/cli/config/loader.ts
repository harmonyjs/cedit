/**
 * CLI configuration loading and assembly utilities
 */

import * as path from 'node:path';
import * as os from 'node:os';
import yaml from 'yaml';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import type { ZodError } from 'zod';
import {
  partialCliConfigFromFileSchema as PartialCliConfigFromFileSchema,
  type PartialCliConfigFromFile,
} from './schemas.js';
import {
  isValidationFailure,
  logValidationIssues,
  isNonEnoentError,
  isEnoentError
} from './validation-helpers.js';
import {
  handleModelValue,
  handleGeneralSettings,
  handleLogConfig,
  handleBackupConfig,
  mergeVarsOverrideSection,
  processApiKey,
} from './loader-helpers.js';

// Default configuration values
const DEFAULT_LOG_DIR = path.join(os.tmpdir(), 'cedit', 'logs');
const DEFAULT_BACKUP_DIR = path.join(os.tmpdir(), 'cedit', 'backups');
const DEFAULT_MODEL = 'claude-3-sonnet-20240229';
const DEFAULT_MAX_TOKENS = 200000;
const DEFAULT_RETRIES = 3;
const DEFAULT_SLEEP_MS = 1000;

/**
 * Default configuration structure. This is the single source of truth for hardcoded defaults.
 */
export const DEFAULT_CONFIG: CliConfig = Object.freeze({
  dryRun: false,
  maxTokens: DEFAULT_MAX_TOKENS,
  model: DEFAULT_MODEL,
  log: {
    level: 'info' as const,
    dir: DEFAULT_LOG_DIR,
  },
  retries: DEFAULT_RETRIES,
  sleepBetweenRequestsMs: DEFAULT_SLEEP_MS,
  backup: {
    dir: DEFAULT_BACKUP_DIR,
    keepForDays: 0,
  },
  defaults: { 
    dryRun: false,
    maxTokens: DEFAULT_MAX_TOKENS,
    model: DEFAULT_MODEL,
    retries: DEFAULT_RETRIES,
    sleepBetweenRequestsMs: DEFAULT_SLEEP_MS,
    // No nested log/backup defaults within the 'defaults' section of DEFAULT_CONFIG itself
    // as those are objects. Individual properties can be defaulted in files.
  },
  varsOverride: {},
  anthropicApiKey: '',
});

/**
 * Load an individual configuration file from the specified path
 */
async function loadIndividualConfigFile(filePath: string): Promise<PartialCliConfigFromFile | null> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const parsedYaml: unknown = yaml.parse(fileContent);
    const validationResult = PartialCliConfigFromFileSchema.safeParse(parsedYaml);
    if (isValidationFailure(validationResult)) {
      logValidationIssues(validationResult.error as ZodError, filePath);
      return null;
    }
    return validationResult.data;
  } catch (error: unknown) {
    if (isNonEnoentError(error)) {
      // Configuration loading happens before logger is available for file I/O error reporting
      // eslint-disable-next-line no-restricted-properties
      console.warn(chalk.yellow(`Warning: Could not load or parse config file at ${filePath}: ${(error as Error).message}`));
    } else if (!isEnoentError(error)) {
      // Configuration loading happens before logger is available for file I/O error reporting
      // eslint-disable-next-line no-restricted-properties
      console.warn(chalk.yellow(`Warning: An unexpected error occurred while processing ${filePath}.`));
    }
    return null;
  }
}

/**
 * Loads config file from the specified path or from standard locations.
 * If customPath is provided, only that file is tried.
 * Returns the parsed config object or an empty object if not found.
 */
export async function loadConfigFile(customPath?: string): Promise<PartialCliConfigFromFile> {
  if (customPath !== undefined && customPath !== '') {
    // If custom path is provided, resolve it and try only that file
    const resolvedPath = path.resolve(customPath);
    const loadedCfg = await loadIndividualConfigFile(resolvedPath);
    if (loadedCfg) {
      return loadedCfg;
    }
    // If custom path was specified but file not found or invalid, throw error
    throw new Error(`Configuration file not found or invalid: ${resolvedPath}`);
  }

  // Use standard locations if no custom path provided
  const homeDir = os.homedir();
  const candidateFiles = [
    path.resolve('.cedit.yml'),
    path.join(homeDir, '.config', 'cedit', 'config.yml'),
    path.join(homeDir, '.cedit.yml'),
  ];
  for (const p of candidateFiles) {
    const loadedCfg = await loadIndividualConfigFile(p);
    if (loadedCfg) {
      return loadedCfg;
    }
  }
  return {}; // Ensure a value is returned if no config file is found
}

/**
 * Loads and merges configuration from various sources
 */
export async function loadConfiguration(flags: CliFlags): Promise<CliConfig> {
  const fileCfg = await loadConfigFile(flags.configPath);
  if (Object.keys(fileCfg).length === 0) {
    if (flags.configPath !== undefined && flags.configPath !== '') {
      // Configuration loading happens before logger is available for informational messages
      // eslint-disable-next-line no-restricted-properties
      console.log(chalk.dim(`No config loaded from ${flags.configPath}, using defaults and CLI flags.`));
    } else {
      // Configuration loading happens before logger is available for informational messages
      // eslint-disable-next-line no-restricted-properties
      console.log(chalk.dim('No config file found, using defaults and CLI flags.'));
    }
  }

  // Create a shallow copy of DEFAULT_CONFIG to prevent modifying the original
  const config: CliConfig = {...DEFAULT_CONFIG};

  // Handle model configuration
  handleModelValue(config, flags, fileCfg);
  
  // Handle general settings
  handleGeneralSettings(config, flags, fileCfg);
  
  // Handle log configuration
  handleLogConfig(config, flags, fileCfg);
  
  // Handle backup configuration
  handleBackupConfig(config, flags, fileCfg);
  
  // Handle API key from environment or config
  processApiKey(config, fileCfg);
  
  // Handle variable overrides
  config.varsOverride = mergeVarsOverrideSection(flags);
  
  return config;
}
