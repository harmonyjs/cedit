/**
 * Helper methods for ConfigBuilder to handle value resolution
 */

import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import type { ConfigOptionValue } from './definitions.js';
import { getNestedValue, safeToString } from './config-utils-helpers.js';

/**
 * Get a value from command-line flags
 */
export function getValueFromCli<TSection extends object, K extends keyof TSection>(
  flags: CliFlags,
  metaValue: ConfigOptionValue<TSection, K>
): TSection[K] | undefined {
  if (typeof metaValue.flagKey === 'string' && 
      metaValue.flagKey in flags && 
      flags[metaValue.flagKey] !== undefined) {
    return metaValue.parser(flags[metaValue.flagKey]);
  }
  return undefined;
}

/**
 * Get a value from environment variables
 */
export function getValueFromEnv<TSection extends object, K extends keyof TSection>(
  metaValue: ConfigOptionValue<TSection, K>
): TSection[K] | undefined {
  if (typeof metaValue.envVarKey === 'string' && metaValue.envVarKey !== '') {
    const envValue = process.env[metaValue.envVarKey];
    if (envValue !== undefined) {
      return metaValue.parser(envValue);
    }
  }
  return undefined;
}

/**
 * Get a value from file configuration
 */
export function getValueFromFile<TSection extends object, K extends keyof TSection>(
  fileCfgFull: Partial<CliConfig>,
  metaValue: ConfigOptionValue<TSection, K>,
  useDefaultPath: boolean
): TSection[K] | undefined {
  // Get path config and early return if not defined
  const pathConfig = useDefaultPath ? metaValue.fileDefaultPath : metaValue.fileConfigPath;
  if (pathConfig === undefined) return undefined;

  // Skip if using default path for defaults section properties
  if (useDefaultPath && metaValue.isDefaultsSectionProperty === true) {
    return undefined;
  }

  // Get and parse the value
  return getAndParseFileValue(fileCfgFull, metaValue, pathConfig);
}

/**
 * Helper to get and parse a value from file configuration
 */
function getAndParseFileValue<TSection extends object, K extends keyof TSection>(
  fileCfgFull: Partial<CliConfig>,
  metaValue: ConfigOptionValue<TSection, K>,
  pathConfig: string | ((fileCfg: Partial<CliConfig>) => unknown)
): TSection[K] | undefined {
  const valFromFile = typeof pathConfig === 'function'
    ? pathConfig(fileCfgFull)
    : getNestedValue(fileCfgFull, pathConfig);
    
  const keyString = String(metaValue.key);
  const isModelProperty = keyString === 'model';
  
  // Log raw value for model
  if (isModelProperty) {
    const pathConfigStr = typeof pathConfig === 'function' ? '[function]' : pathConfig;
    // Configuration loading happens before logger is available for debug output during development
    // eslint-disable-next-line no-restricted-properties
    console.log(`Value from file (${pathConfigStr}): `, valFromFile);
  }
  
  // Parse and return the value if defined
  if (valFromFile !== undefined) {
    const parsedValue = metaValue.parser(valFromFile);
    
    // Log parsed value for model
    if (isModelProperty && parsedValue !== undefined) {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.log(`Parsed value for model: "${safeToString(parsedValue)}"`);
    }
    
    return parsedValue;
  }
  return undefined;
}
