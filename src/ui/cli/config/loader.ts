/**
 * CLI configuration loading and assembly utilities
 */

import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import { type ZodIssue, type ZodError } from 'zod';
import {
  partialCliConfigFromFileSchema as PartialCliConfigFromFileSchema,
  type PartialCliConfigFromFile,
} from './schemas.js';
import {
  CONFIG_METADATA, // Still needed for loadConfiguration
} from './definitions.js';
import {
  ConfigBuilder // Import ConfigBuilder
} from './config-utils.js';

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
 * Returns true if the validation result is a failure.
 */
function isValidationFailure(result: unknown): result is { success: false; error: ZodError } {
  return (
    typeof result === 'object' && 
    result !== null && 
    'success' in result && 
    // Type guard to avoid using 'any'
    typeof result === 'object' &&
    result !== null &&
    'success' in result && 
    result.success === false
  );
}

/**
 * Logs validation issues to the console.
 */
function logValidationIssues(error: ZodError, filePath: string): void {
  console.warn(chalk.yellow(`Warning: Configuration file at ${filePath} has validation errors:`));
  error.issues.forEach((issue: ZodIssue) => {
    console.warn(chalk.yellow(`  - Path: ${issue.path.join('.')}, Message: ${issue.message}`));
  });
}

/**
 * Returns true if the error is not an ENOENT error.
 */
function isNonEnoentError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string' && (error as { code: string }).code !== 'ENOENT';
}

/**
 * Returns true if the error is an ENOENT error.
 */
function isEnoentError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof (error as { code: unknown }).code === 'string' && (error as { code: string }).code === 'ENOENT';
}

function mergeVarsOverrideSection(flags: CliFlags): Record<string, string> {
  // Magic number 2: exactly two parts expected for key=value pairs
  const KEY_VALUE_PAIR_LENGTH = 2;
  return flags.var.reduce<Record<string, string>>((acc, pair) => {
    const parts = pair.split('=');
    if (parts.length === KEY_VALUE_PAIR_LENGTH) {
      acc[parts[0].trim()] = parts[1].trim();
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
      // console.log(chalk.dim(`Loaded configuration from: ${p}`)); // Optional: log which file was loaded
      return loadedCfg;
    }
  }
  return {}; // Ensure a value is returned if no config file is found
}

export async function loadConfiguration(flags: CliFlags): Promise<CliConfig> {
  const fileCfg = await loadConfigFile();
  if (Object.keys(fileCfg).length === 0) {
    console.log(chalk.dim('No config file found, using defaults and CLI flags.'));
  }

  // Instantiate the builder
  const builder = new ConfigBuilder(flags, fileCfg as Partial<CliConfig>);

  // Use the builder to construct the main configuration
  const mergedConfig = builder.buildSection(
    DEFAULT_CONFIG, // Hardcoded defaults for the top-level CliConfig structure
    CONFIG_METADATA
  );
  
  mergedConfig.varsOverride = mergeVarsOverrideSection(flags);
  return mergedConfig;
}
