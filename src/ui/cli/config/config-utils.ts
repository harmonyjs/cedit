/**
 * Configuration building utilities
 */

import chalk from 'chalk';
import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import type { ConfigMetadata, ConfigOptionValue } from './definitions.js';
import { 
  getNestedValue, 
  safeToString, 
  resolveConfigPath as resolveConfigPathHelper,
  initializeWithDefaults 
} from './config-utils-helpers.js';
import {
  getValueFromCli,
  getValueFromEnv,
  getValueFromFile
} from './config-builder-helpers.js';

// Re-export helpers
export { getNestedValue, resolveConfigPathHelper as resolveConfigPath };

// Type for metadata processor params
type MetadataProcessorParams<TSection extends object> = {
  metaEntry: ConfigMetadata<TSection>[number];
  key: keyof TSection;
  sectionDefaults: Readonly<TSection>;
  result: Partial<TSection>;
};

// Encapsulates the logic for building the configuration
export class ConfigBuilder {
  private readonly flags: CliFlags;
  private readonly fileCfgFull: Partial<CliConfig>;

  constructor(flags: CliFlags, fileCfgFull: Partial<CliConfig>) {
    this.flags = flags;
    this.fileCfgFull = fileCfgFull;
    
    // Log the loaded model value from the file config, if present
    if (this.fileCfgFull.model !== undefined && this.fileCfgFull.model !== null && this.fileCfgFull.model !== '') {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.log(`Config file contains model: "${this.fileCfgFull.model}"`);
    }
  }

  /**
   * Builds a configuration section from defaults and metadata
   */
  public buildSection<TSection extends object>(
    sectionDefaults: Readonly<TSection>,
    metadata: ConfigMetadata<TSection>
  ): TSection {
    // Initialize with defaults
    const result = initializeWithDefaults(sectionDefaults);
    
    // Process each metadata entry
    for (const metaEntry of metadata) {
      this.processMetadataEntry({
        metaEntry,
        key: metaEntry.key,
        sectionDefaults,
        result
      });
    }
    
    return result as TSection;
  }

  /**
   * Process a single metadata entry
   */
  private processMetadataEntry<TSection extends object>(
    params: MetadataProcessorParams<TSection>
  ): void {
    const { metaEntry, key, sectionDefaults, result } = params;
    
    if (metaEntry.isNested === true) {
      this.processNestedEntry({
        metaEntry: metaEntry as ConfigMetadata<TSection>[number] & { isNested: true },
        key,
        sectionDefaults,
        result
      });
    } else {
      this.processSimpleEntry({
        metaEntry,
        key,
        sectionDefaults,
        result
      });
    }
  }

  /**
   * Process a nested metadata entry
   */
  private processNestedEntry<TSection extends object>(
    params: MetadataProcessorParams<TSection> & { 
      metaEntry: ConfigMetadata<TSection>[number] & { isNested: true }
    }
  ): void {
    const { metaEntry, key, sectionDefaults, result } = params;
    const nestedDefaults = sectionDefaults[key];
    const keyString = String(key);
    
    // Skip if defaults aren't an object
    if (typeof nestedDefaults !== 'object' || nestedDefaults === null) {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.warn(chalk.yellow(`Warning: Default value for nested key '${keyString}' is not an object in hardcoded defaults. Skipping.`));
      
      if (sectionDefaults[key] !== undefined) {
        result[key] = {} as TSection[typeof key];
      }
      return;
    }
    
    // Recursively build nested section
    result[key] = this.buildSection(
      nestedDefaults as Readonly<Extract<TSection[typeof key], object>>,
      metaEntry.nestedMetadata as ConfigMetadata<Extract<TSection[typeof key], object>>
    );
  }

  /**
   * Process a simple (non-nested) metadata entry
   */
  private processSimpleEntry<TSection extends object>(
    params: MetadataProcessorParams<TSection>
  ): void {
    const { metaEntry, key, sectionDefaults, result } = params;
    if (metaEntry.isNested === true) return;
    
    const resolvedValue = this.resolveSingleValue(metaEntry, sectionDefaults[key]);
    
    // Log the resolved model value
    const keyString = String(key);
    if (keyString === 'model' && resolvedValue !== undefined) {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.log(`Resolved model value: "${safeToString(resolvedValue)}"`);
    }
    
    // Only set the value if it's defined
    if (resolvedValue !== undefined) {
      result[key] = resolvedValue;
    }
  }

  /**
   * Resolve a single config value from all possible sources
   */
  private resolveSingleValue<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
    hardcodedDefaultForKey: TSection[K] | undefined
  ): TSection[K] | undefined {
    // Get the key and check if it's the model property
    const isModelProperty = String(metaValue.key) === 'model';
    
    if (isModelProperty) {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.log(`Resolving value for model property...`);
    }

    return this.getFromCliOrEnv(metaValue, isModelProperty) ||
           this.getFromFileCfg(metaValue, hardcodedDefaultForKey, isModelProperty);
  }

  /**
   * Attempt to get value from CLI or environment variables
   */
  private getFromCliOrEnv<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
    isModelProperty: boolean
  ): TSection[K] | undefined {
    // Try CLI
    const cliValue = getValueFromCli(this.flags, metaValue);
    if (cliValue !== undefined) {
      if (isModelProperty) {
        // Configuration loading happens before logger is available for debug output during development
        // eslint-disable-next-line no-restricted-properties
        console.log(`Using CLI value for model: "${safeToString(cliValue)}"`);
      }
      return cliValue;
    }

    // Try ENV 
    const envValue = getValueFromEnv(metaValue);
    if (envValue !== undefined) {
      if (isModelProperty) {
        // Configuration loading happens before logger is available for debug output during development
        // eslint-disable-next-line no-restricted-properties
        console.log(`Using ENV value for model: "${safeToString(envValue)}"`);
      }
      return envValue;
    }

    return undefined;
  }

  /**
   * Attempt to get value from file configuration or use default
   */
  private getFromFileCfg<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
    hardcodedDefaultForKey: TSection[K] | undefined,
    isModelProperty: boolean
  ): TSection[K] | undefined {
    // Try config file
    const configFileValue = getValueFromFile(this.fileCfgFull, metaValue, false);
    if (configFileValue !== undefined) {
      if (isModelProperty) {
        // Configuration loading happens before logger is available for debug output during development
        // eslint-disable-next-line no-restricted-properties
        console.log(`Using file config value for model: "${safeToString(configFileValue)}"`);
      }
      return configFileValue;
    }

    // Try default file path
    const defaultFileValue = getValueFromFile(this.fileCfgFull, metaValue, true);
    if (defaultFileValue !== undefined) {
      if (isModelProperty) {
        // Configuration loading happens before logger is available for debug output during development
        // eslint-disable-next-line no-restricted-properties
        console.log(`Using default file config value for model: "${safeToString(defaultFileValue)}"`);
      }
      return defaultFileValue;
    }

    // Use hardcoded default
    if (isModelProperty && hardcodedDefaultForKey !== undefined) {
      // Configuration loading happens before logger is available for debug output during development
      // eslint-disable-next-line no-restricted-properties
      console.log(`Using hardcoded default for model: "${safeToString(hardcodedDefaultForKey)}"`);
    }
    
    return hardcodedDefaultForKey;
  }
}
