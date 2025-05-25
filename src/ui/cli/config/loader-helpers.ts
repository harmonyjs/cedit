/**
 * Helper functions for CLI configuration loading
 */

import chalk from 'chalk';
import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import type { PartialCliConfigFromFile } from './schemas.js';

/**
 * Handles model configuration
 */
export function handleModelValue(
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
export function handleGeneralSettings(
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
export function handleLogConfig(
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
export function handleBackupConfig(
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
 * Processes variable overrides from CLI flags
 */
export function mergeVarsOverrideSection(flags: CliFlags): Record<string, string> {
  // Magic number 2: exactly two parts expected for key=value pairs
  const KEY_VALUE_PAIR_LENGTH = 2;
  return flags.var.reduce<Record<string, string>>((acc, pair) => {
    const parts = pair.split('=');
    if (parts.length === KEY_VALUE_PAIR_LENGTH) {
      if (typeof parts[0] !== 'undefined' && typeof parts[1] !== 'undefined') {
        acc[parts[0].trim()] = parts[1].trim();
      }
    } else {
      // Configuration parsing happens before logger is available for CLI argument validation
      // eslint-disable-next-line no-restricted-properties
      console.warn(chalk.yellow(`Ignoring invalid --var format: "${pair}"`));
    }
    return acc;
  }, {});
}

/**
 * Processes API key from environment or config file
 */
export function processApiKey(
  config: CliConfig,
  fileCfg: PartialCliConfigFromFile
): void {
  const envApiKey = process.env['ANTHROPIC_API_KEY'];
  if (typeof envApiKey === 'string' && envApiKey !== '') {
    config.anthropicApiKey = envApiKey;
  } else if (typeof fileCfg.anthropicApiKey === 'string' && fileCfg.anthropicApiKey !== '') {
    config.anthropicApiKey = fileCfg.anthropicApiKey;
  }
}