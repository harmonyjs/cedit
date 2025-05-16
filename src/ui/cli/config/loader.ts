/**
 * CLI configuration loading and assembly utilities
 */

import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path
import type { CliFlags } from '../main.js'; // Adjusted path
import { type ZodIssue, type ZodError } from 'zod'; // Added ZodError for type safety
import {
  PartialCliConfigFromFileSchema,
  type PartialCliConfigFromFile,
} from './schemas.js'; // Adjusted path
import {
  type ConfigMetadata,
  type ConfigOptionValue,
  CONFIG_METADATA,
} from './definitions.js'; // Adjusted path

// Default configuration values
const DEFAULT_LOG_DIR = path.join(os.tmpdir(), 'cedit', 'logs');
const DEFAULT_BACKUP_DIR = path.join(os.tmpdir(), 'cedit', 'backups');
const DEFAULT_MODEL = 'claude-3-sonnet-20240229';
const DEFAULT_MAX_TOKENS = 200000;
const DEFAULT_RETRIES = 3;
const DEFAULT_SLEEP_MS = 1000;

// Helper to safely access nested properties from a config object
// Moved definition earlier to ensure it's parsed before any potential use,
// although lexical scoping should handle this regardless of position.
function getNestedValue(obj: Record<string, unknown> | undefined | null, pathString: string): unknown {
  if (!obj) return undefined;
  return pathString.split('.').reduce((acc: unknown, part: string) => {
    // Check if acc is an object and has the property before accessing
    if (typeof acc === 'object' && acc !== null && Object.prototype.hasOwnProperty.call(acc, part)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// Helper to get value from CLI flags
function _getValueFromCli<T_Section extends object, K extends keyof T_Section>(
  metaValue: ConfigOptionValue<T_Section, K>,
  flags: CliFlags
): T_Section[K] | undefined {
  if (metaValue.flagKey && flags[metaValue.flagKey] !== undefined) {
    return metaValue.parser(flags[metaValue.flagKey]);
  }
  return undefined;
}

// Helper to get value from environment variables
function _getValueFromEnv<T_Section extends object, K extends keyof T_Section>(
  metaValue: ConfigOptionValue<T_Section, K>
): T_Section[K] | undefined {
  if (metaValue.envVarKey) {
    const envValue = process.env[metaValue.envVarKey];
    if (envValue !== undefined) {
      return metaValue.parser(envValue);
    }
  }
  return undefined;
}

// Helper to get value from file configuration (direct or defaults path)
function _getValueFromFile<T_Section extends object, K extends keyof T_Section>(
  metaValue: ConfigOptionValue<T_Section, K>,
  fileCfgFull: Partial<CliConfig>,
  useDefaultPath: boolean
): T_Section[K] | undefined {
  const pathConfig = useDefaultPath ? metaValue.fileDefaultPath : metaValue.fileConfigPath;
  if (!pathConfig) return undefined;

  // Skip file default path if this key is itself a property of the 'defaults' section being populated
  if (useDefaultPath && metaValue.isDefaultsSectionProperty) return undefined;

  const valFromFile = typeof pathConfig === 'function'
    ? pathConfig(fileCfgFull)
    : getNestedValue(fileCfgFull, pathConfig);

  if (valFromFile !== undefined) {
    return metaValue.parser(valFromFile);
  }
  return undefined;
}

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

// Encapsulates the logic for building the configuration
class ConfigBuilder {
  private flags: CliFlags;
  private fileCfgFull: Partial<CliConfig>;

  constructor(flags: CliFlags, fileCfgFull: Partial<CliConfig>) {
    this.flags = flags;
    this.fileCfgFull = fileCfgFull;
  }

  // Helper to resolve a single, non-nested configuration value
  private _resolveSingleValue<T_Section extends object, K extends keyof T_Section>(
    metaValue: ConfigOptionValue<T_Section, K>,
    hardcodedDefaultForKey: T_Section[K] | undefined
  ): T_Section[K] | undefined {
    let resolvedValue: T_Section[K] | undefined;

    resolvedValue = _getValueFromCli(metaValue, this.flags);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = _getValueFromEnv(metaValue);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = _getValueFromFile(metaValue, this.fileCfgFull, false); // Direct path
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = _getValueFromFile(metaValue, this.fileCfgFull, true); // Default path
    if (resolvedValue !== undefined) return resolvedValue;

    return hardcodedDefaultForKey; // Fallback to hardcoded default
  }

  // Merges a section of the configuration
  public buildSection<T_Section extends object>(
    sectionDefaults: Readonly<T_Section>,
    metadata: ConfigMetadata<T_Section>
  ): T_Section {
    const result: Partial<T_Section> = {};

    for (const metaEntry of metadata) {
      const key = metaEntry.key;

      if (metaEntry.isNested) {
        const metaNested = metaEntry; // Already narrowed
        const nestedSectionHardcodedDefaults = sectionDefaults[key];

        if (typeof nestedSectionHardcodedDefaults !== 'object' || nestedSectionHardcodedDefaults === null) {
          console.warn(chalk.yellow(`Warning: Default value for nested key '${String(key)}' is not an object in hardcoded defaults. Skipping.`));
          if (typeof sectionDefaults[key] !== 'undefined') {
            result[key] = {} as T_Section[typeof key];
          }
          continue;
        }
        
        // Recursive call using the same builder instance (it holds the necessary state: flags, fileCfgFull)
        result[key] = this.buildSection(
          nestedSectionHardcodedDefaults as Readonly<Extract<T_Section[typeof key], object>>,
          metaNested.nestedMetadata as ConfigMetadata<Extract<T_Section[typeof key], object>>
        );
      } else {
        const metaValue = metaEntry; // Already narrowed
        result[key] = this._resolveSingleValue(
          metaValue,
          sectionDefaults[key]
        );
      }
    }
    return result as T_Section;
  }
}

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
