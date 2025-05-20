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
      console.warn(chalk.yellow(`Warning: Could not load or parse config file at ${filePath}: ${(error as Error).message}`));
    } else if (!isEnoentError(error)) {
      console.warn(chalk.yellow(`Warning: An unexpected error occurred while processing ${filePath}.`));
    }
    return null;
  }
}

/**
 * Processes variable overrides from CLI flags
 */
function mergeVarsOverrideSection(flags: CliFlags): Record<string, string> {
  // Magic number 2: exactly two parts expected for key=value pairs
  const KEY_VALUE_PAIR_LENGTH = 2;
  return flags.var.reduce<Record<string, string>>((acc, pair) => {
    const parts = pair.split('=');
    if (parts.length === KEY_VALUE_PAIR_LENGTH) {
      if (typeof parts[0] !== 'undefined' && typeof parts[1] !== 'undefined') {
        acc[parts[0].trim()] = parts[1].trim();
      }
    } else {
      console.warn(chalk.yellow(`Ignoring invalid --var format: "${pair}"`));
    }
    return acc;
  }, {});
}

/**
 * Loads the first found config file from the standard locations.
 * Returns the parsed config object or an empty object if not found.
 */
export async function loadConfigFile(): Promise<PartialCliConfigFromFile> {
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
 * Handles model configuration
 */
function handleModelValue(
  config: CliConfig, 
  flags: CliFlags, 
  fileCfg: PartialCliConfigFromFile
): void {
  // Handle model
  if (typeof flags.model === 'string' && flags.model !== '') {
    config.model = flags.model;
  } else if (typeof fileCfg.model === 'string' && fileCfg.model !== '') {
    config.model = fileCfg.model;
  }
}

/**
 * Handles general numeric and boolean settings
 */
function handleGeneralSettings(
  config: CliConfig, 
  flags: CliFlags, 
  fileCfg: PartialCliConfigFromFile
): void {
  // Handle dryRun - check if it's explicitly set in flags (not undefined)
  if (flags.dryRun !== undefined) {
    config.dryRun = flags.dryRun;
  } else if (typeof fileCfg.dryRun === 'boolean') {
    config.dryRun = fileCfg.dryRun;
  }
  
  // Handle maxTokens
  if (typeof flags.maxTokens === 'number') {
    config.maxTokens = flags.maxTokens;
  } else if (typeof fileCfg.maxTokens === 'number') {
    config.maxTokens = fileCfg.maxTokens;
  }
  
  // Handle retries
  if (typeof flags.retries === 'number') {
    config.retries = flags.retries;
  } else if (typeof fileCfg.retries === 'number') {
    config.retries = fileCfg.retries;
  }
  
  // Handle sleepBetweenRequestsMs
  if (typeof flags.sleepMs === 'number') {
    config.sleepBetweenRequestsMs = flags.sleepMs;
  } else if (typeof fileCfg.sleepBetweenRequestsMs === 'number') {
    config.sleepBetweenRequestsMs = fileCfg.sleepBetweenRequestsMs;
  }
}

/**
 * Handles log configuration
 */
function handleLogConfig(
  config: CliConfig, 
  flags: CliFlags, 
  fileCfg: PartialCliConfigFromFile
): void {
  // Handle log config from file
  if (fileCfg.log) {
    if (fileCfg.log.level === 'info' || fileCfg.log.level === 'error') {
      config.log.level = fileCfg.log.level;
    }
    if (typeof fileCfg.log.dir === 'string' && fileCfg.log.dir !== '') {
      config.log.dir = fileCfg.log.dir;
    }
  }
  
  // Handle log level from command line (takes precedence)
  if (typeof flags.logLevel === 'string' && flags.logLevel !== '') {
    config.log.level = flags.logLevel as 'info' | 'error';
  }
  
  // Handle log directory from command line (takes precedence)
  if (typeof flags.logDir === 'string' && flags.logDir !== '') {
    config.log.dir = flags.logDir;
  }
}

/**
 * Handles backup configuration
 */
function handleBackupConfig(
  config: CliConfig, 
  flags: CliFlags, 
  fileCfg: PartialCliConfigFromFile
): void {
  // Handle backup config from file
  if (fileCfg.backup) {
    if (typeof fileCfg.backup.dir === 'string' && fileCfg.backup.dir !== '') {
      config.backup.dir = fileCfg.backup.dir;
    }
    if (typeof fileCfg.backup.keepForDays === 'number') {
      config.backup.keepForDays = fileCfg.backup.keepForDays;
    }
  }
  
  // Handle backup directory from command line (takes precedence)
  if (typeof flags.backupDir === 'string' && flags.backupDir !== '') {
    config.backup.dir = flags.backupDir;
  }
}

/**
 * Loads and merges configuration from various sources
 */
export async function loadConfiguration(flags: CliFlags): Promise<CliConfig> {
  const fileCfg = await loadConfigFile();
  if (Object.keys(fileCfg).length === 0) {
    console.log(chalk.dim('No config file found, using defaults and CLI flags.'));
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
  const envApiKey = process.env['ANTHROPIC_API_KEY'];
  if (typeof envApiKey === 'string' && envApiKey !== '') {
    config.anthropicApiKey = envApiKey;
  } else if (typeof fileCfg.anthropicApiKey === 'string' && fileCfg.anthropicApiKey !== '') {
    config.anthropicApiKey = fileCfg.anthropicApiKey;
  }
  
  // Handle variable overrides
  config.varsOverride = mergeVarsOverrideSection(flags);
  
  return config;
}
