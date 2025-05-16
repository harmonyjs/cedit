/**
 * Definitions for CLI configuration metadata.
 */
import type { CliConfig, LogConfig, BackupConfig, DefaultConfig } from '../../../app/model/index.js'; // Adjusted path
import type { CliFlags } from '../main.js'; // Adjusted path
import {
  parseYamlString,
  parseAndResolvePath,
  parseYamlBoolean,
  parseYamlNumber,
  parseLogLevel,
} from './value-parsers.js'; // Adjusted path

// Type for a function that parses a configuration value
export type ConfigValueParser<T> = (value: unknown) => T | undefined;

// Base interface for common properties shared by all metadata entries
export interface ConfigOptionBase<T_ConfigObject extends object, K extends keyof T_ConfigObject> {
  key: K;
  // Path to the value in the main config file (e.g., 'log.level')
  fileConfigPath?: string | ((fileCfg: Partial<CliConfig>) => unknown);
  // Path to the value in the file config's 'defaults' section (e.g., 'defaults.log.level')
  fileDefaultPath?: string | ((fileCfg: Partial<CliConfig>) => unknown);
  flagKey?: keyof CliFlags;
  envVarKey?: string;
  // True if this metadata describes a property within the 'defaults' section of the config file
  isDefaultsSectionProperty?: boolean;
}

// For simple, non-nested configuration values that have a direct parser
export interface ConfigOptionValue<T_ConfigObject extends object, K extends keyof T_ConfigObject> extends ConfigOptionBase<T_ConfigObject, K> {
  parser: ConfigValueParser<T_ConfigObject[K]>;
  isNested?: false | undefined; // Explicitly not nested
  nestedMetadata?: undefined;
}

// For nested configuration objects (like 'log', 'backup', 'defaults')
export interface ConfigOptionNested<T_ConfigObject extends object, K extends keyof T_ConfigObject> extends ConfigOptionBase<T_ConfigObject, K> {
  isNested: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accommodates truly heterogeneous nested config structures passed to a generic merging function.
  nestedMetadata: ConfigMetadata<any>;
  parser?: undefined; // Nested objects themselves don't have a single parser; their children do.
  // Special flag if this nested object *is* the top-level 'defaults' section from the config file
  isTopLevelDefaultsSection?: boolean;
}

// Discriminated union for individual entries in the ConfigMetadata array
export type ConfigOptionMetadataEntry<T_ConfigObject extends object, K extends keyof T_ConfigObject> =
  ConfigOptionValue<T_ConfigObject, K> | ConfigOptionNested<T_ConfigObject, K>;

// The main ConfigMetadata type: an array of these entries.
// K (keyof T_ConfigObject) is inferred by TypeScript when creating the array.
export type ConfigMetadata<T_ConfigObject extends object> = Array<ConfigOptionMetadataEntry<T_ConfigObject, keyof T_ConfigObject>>;

export const CONFIG_METADATA: ConfigMetadata<CliConfig> = [
  { key: 'dry_run', flagKey: 'dry_run', fileConfigPath: 'dry_run', fileDefaultPath: 'defaults.dry_run', parser: parseYamlBoolean, isNested: false },
  { key: 'max_tokens', flagKey: 'max_tokens', fileConfigPath: 'max_tokens', fileDefaultPath: 'defaults.max_tokens', parser: parseYamlNumber, isNested: false },
  { key: 'model', flagKey: 'model', fileConfigPath: 'model', fileDefaultPath: 'defaults.model', parser: parseYamlString, isNested: false },
  { key: 'retries', flagKey: 'retries', fileConfigPath: 'retries', fileDefaultPath: 'defaults.retries', parser: parseYamlNumber, isNested: false },
  { key: 'sleep_between_requests_ms', flagKey: 'sleep_ms', fileConfigPath: 'sleep_between_requests_ms', fileDefaultPath: 'defaults.sleep_between_requests_ms', parser: parseYamlNumber, isNested: false },
  { key: 'anthropic_api_key', envVarKey: 'ANTHROPIC_API_KEY', fileConfigPath: 'anthropic_api_key', parser: parseYamlString, isNested: false },
  {
    key: 'log',
    isNested: true,
    fileConfigPath: 'log', // The 'log' object in the config file
    nestedMetadata: [
      { key: 'level', flagKey: 'log_level', fileConfigPath: 'log.level', fileDefaultPath: 'defaults.log.level', parser: parseLogLevel, isNested: false, isDefaultsSectionProperty: false },
      { key: 'dir', flagKey: 'log_dir', fileConfigPath: 'log.dir', fileDefaultPath: 'defaults.log.dir', parser: parseAndResolvePath, isNested: false, isDefaultsSectionProperty: false },
    ] as ConfigMetadata<LogConfig>,
  },
  {
    key: 'backup',
    isNested: true,
    fileConfigPath: 'backup', // The 'backup' object in the config file
    nestedMetadata: [
      { key: 'dir', flagKey: 'backup_dir', fileConfigPath: 'backup.dir', fileDefaultPath: 'defaults.backup.dir', parser: parseAndResolvePath, isNested: false, isDefaultsSectionProperty: false },
      { key: 'keep_for_days', fileConfigPath: 'backup.keep_for_days', fileDefaultPath: 'defaults.backup.keep_for_days', parser: parseYamlNumber, isNested: false, isDefaultsSectionProperty: false },
    ] as ConfigMetadata<BackupConfig>,
  },
  {
    key: 'defaults', // This refers to the 'defaults' section in CliConfig, which holds resolved default values.
    isNested: true,
    isTopLevelDefaultsSection: true, // Mark this as the special 'defaults' section from the config file
    fileConfigPath: 'defaults',   // The 'defaults' object in the config file
    nestedMetadata: [ // These define how to parse values *from* the 'defaults' section of a config file
      { key: 'dry_run', fileConfigPath: 'defaults.dry_run', parser: parseYamlBoolean, isNested: false, isDefaultsSectionProperty: true },
      { key: 'max_tokens', fileConfigPath: 'defaults.max_tokens', parser: parseYamlNumber, isNested: false, isDefaultsSectionProperty: true },
      { key: 'model', fileConfigPath: 'defaults.model', parser: parseYamlString, isNested: false, isDefaultsSectionProperty: true },
      { key: 'retries', fileConfigPath: 'defaults.retries', parser: parseYamlNumber, isNested: false, isDefaultsSectionProperty: true },
      { key: 'sleep_between_requests_ms', fileConfigPath: 'defaults.sleep_between_requests_ms', parser: parseYamlNumber, isNested: false, isDefaultsSectionProperty: true },
    ] as ConfigMetadata<DefaultConfig>, // DefaultConfig is the type for CliConfig['defaults']
  },
];
