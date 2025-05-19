import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk'; // For ConfigBuilder console.warn
import * as fsConstants from 'node:fs'; // For fs.constants.R_OK
import type { CliConfig } from '../../../app/model/index.js';
import type { CliFlags } from '../types.js';
import type { ConfigMetadata, ConfigOptionValue } from './definitions.js';

/**
 * Helper to safely access nested properties from a config object.
 */
export function getNestedValue(obj: Record<string, unknown> | undefined | null, pathString: string): unknown {
  if (!obj) return undefined;
  return pathString.split('.').reduce((acc: unknown, part: string) => {
    if (typeof acc === 'object' && acc !== null && Object.prototype.hasOwnProperty.call(acc, part)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Resolves the path to the first found configuration file from standard locations.
 * Returns undefined if no config file is found.
 */
export function resolveConfigPath(fsAccessSync: (path: string, mode?: number) => void, candidateFiles?: string[]): string | undefined {
  const homeDir = os.homedir();
  const defaultCandidates = [
    path.resolve('.cedit.yml'),
    path.join(homeDir, '.config', 'cedit', 'config.yml'),
    path.join(homeDir, '.cedit.yml'),
  ];
  const filesToTry = candidateFiles || defaultCandidates;

  for (const p of filesToTry) {
    try {
      fsAccessSync(p, fsConstants.constants.R_OK);
      return p;
    } catch {
      // File doesn't exist or isn't readable, continue
    }
  }
  return undefined;
}

// Encapsulates the logic for building the configuration
export class ConfigBuilder {
  private readonly flags: CliFlags;
  private readonly fileCfgFull: Partial<CliConfig>;

  constructor(flags: CliFlags, fileCfgFull: Partial<CliConfig>) {
    this.flags = flags;
    this.fileCfgFull = fileCfgFull;
  }

  public buildSection<TSection extends object>(
    sectionDefaults: Readonly<TSection>,
    metadata: ConfigMetadata<TSection>
  ): TSection {
    const result: Partial<TSection> = {};
    for (const metaEntry of metadata) {
      const key = metaEntry.key;
      if (metaEntry.isNested === true) { // strict-boolean-expressions
        const metaNested = metaEntry;
        const nestedSectionHardcodedDefaults = sectionDefaults[key];
        // Ensure nestedSectionHardcodedDefaults is an object and not null
        if (typeof nestedSectionHardcodedDefaults !== 'object' || nestedSectionHardcodedDefaults === null) { // strict-boolean-expressions
          console.warn(chalk.yellow(`Warning: Default value for nested key '${String(key)}' is not an object in hardcoded defaults. Skipping.`));
          // Ensure sectionDefaults[key] is not undefined before assigning empty object
          if (typeof sectionDefaults[key] !== 'undefined') { // strict-boolean-expressions
            result[key] = {} as TSection[typeof key];
          }
          continue;
        }
        result[key] = this.buildSection(
          nestedSectionHardcodedDefaults as Readonly<Extract<TSection[typeof key], object>>,
          metaNested.nestedMetadata as ConfigMetadata<Extract<TSection[typeof key], object>>
        );
      } else {
        const metaValue = metaEntry;
        result[key] = this.resolveSingleValue(
          metaValue,
          sectionDefaults[key]
        );
      }
    }
    return result as TSection;
  }

  private getValueFromCli<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
  ): TSection[K] | undefined {
    // Ensure flagKey exists and is a valid key of CliFlags before accessing this.flags
    if (typeof metaValue.flagKey === 'string' && metaValue.flagKey in this.flags && typeof this.flags[metaValue.flagKey] !== 'undefined') { // strict-boolean-expressions
      return metaValue.parser(this.flags[metaValue.flagKey]);
    }
    return undefined;
  }

  private getValueFromFile<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
    useDefaultPath: boolean
  ): TSection[K] | undefined {
    const pathConfig = useDefaultPath ? metaValue.fileDefaultPath : metaValue.fileConfigPath;
    if (typeof pathConfig === 'undefined') return undefined; // strict-boolean-expressions

    // Ensure isDefaultsSectionProperty is explicitly checked for boolean value
    if (useDefaultPath && (metaValue.isDefaultsSectionProperty === true)) return undefined; // strict-boolean-expressions

    const valFromFile = typeof pathConfig === 'function'
      ? pathConfig(this.fileCfgFull)
      : getNestedValue(this.fileCfgFull, pathConfig);

    if (valFromFile !== undefined) {
      return metaValue.parser(valFromFile);
    }
    return undefined;
  }

  private resolveSingleValue<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>,
    hardcodedDefaultForKey: TSection[K] | undefined
  ): TSection[K] | undefined {
    let resolvedValue: TSection[K] | undefined;

    resolvedValue = this.getValueFromCli(metaValue);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = ConfigBuilder.getValueFromEnv(metaValue);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = this.getValueFromFile(metaValue, false);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = this.getValueFromFile(metaValue, true);
    if (resolvedValue !== undefined) return resolvedValue;

    return hardcodedDefaultForKey;
  }

  // This method can be static as it doesn't use 'this'
  private static getValueFromEnv<TSection extends object, K extends keyof TSection>(
    metaValue: ConfigOptionValue<TSection, K>
  ): TSection[K] | undefined {
    if (typeof metaValue.envVarKey === 'string' && metaValue.envVarKey !== '') { // strict-boolean-expressions
      const envValue = process.env[metaValue.envVarKey];
      if (typeof envValue !== 'undefined') { // strict-boolean-expressions
        return metaValue.parser(envValue);
      }
    }
    return undefined;
  }
}
