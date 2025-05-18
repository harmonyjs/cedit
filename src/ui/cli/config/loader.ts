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
  PartialCliConfigFromFileSchema,
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
export const DEFAULT_CONFIG: Readonly<CliConfig> = Object.freeze({
  dry_run: false,
  max_tokens: DEFAULT_MAX_TOKENS,
  model: DEFAULT_MODEL,
  log: {
    level: 'info' as const,
    dir: DEFAULT_LOG_DIR,
  },
  retries: DEFAULT_RETRIES,
  sleep_between_requests_ms: DEFAULT_SLEEP_MS,
  backup: {
    dir: DEFAULT_BACKUP_DIR,
    keep_for_days: 0,
  },
  defaults: { 
    dry_run: false,
    max_tokens: DEFAULT_MAX_TOKENS,
    model: DEFAULT_MODEL,
    retries: DEFAULT_RETRIES,
    sleep_between_requests_ms: DEFAULT_SLEEP_MS,
    // No nested log/backup defaults within the 'defaults' section of DEFAULT_CONFIG itself
    // as those are objects. Individual properties can be defaulted in files.
  },
  varsOverride: {},
  anthropic_api_key: '',
});

/**
 * Load an individual configuration file from the specified path
 */
async function loadIndividualConfigFile(filePath: string): Promise<PartialCliConfigFromFile | null> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Assuming parsedYaml could be anything, but we expect it to conform to PartialCliConfigFromFile or be an object
    const parsedYaml: unknown = yaml.parse(fileContent);

    // Validate the structure of the loaded config file
    const validationResult = PartialCliConfigFromFileSchema.safeParse(parsedYaml);

    if (!validationResult.success) {
      console.warn(chalk.yellow(`Warning: Configuration file at ${filePath} has validation errors:`));
      // Type assertion for ZodError is safe here because success is false
      (validationResult.error as ZodError).issues.forEach((issue: ZodIssue) => {
        console.warn(chalk.yellow(`  - Path: ${issue.path.join('.')}, Message: ${issue.message}`));
      });
      return null;
    }
    return validationResult.data;
  } catch (error) { // Use unknown for better type safety
    // Type guard for error handling
    if (error instanceof Error && 'code' in error && (error as { code: string }).code !== 'ENOENT') {
      console.warn(chalk.yellow(`Warning: Could not load or parse config file at ${filePath}: ${error.message}`));
    } else if (!(error instanceof Error && 'code' in error && (error as { code: string }).code === 'ENOENT')) {
      // Log if it's not a file not found error and not an error with a message (e.g., non-Error object thrown)
      console.warn(chalk.yellow(`Warning: An unexpected error occurred while processing ${filePath}.`));
    }
    return null;
  }
}

function mergeVarsOverrideSection(flags: CliFlags): Record<string, string> {
  return flags.var.reduce<Record<string, string>>((acc, pair) => {
    const parts = pair.split('=');
    if (parts.length === 2) {
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
