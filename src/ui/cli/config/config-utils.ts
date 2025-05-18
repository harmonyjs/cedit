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

  private _getValueFromCli<T_Section extends object, K extends keyof T_Section>(
    metaValue: ConfigOptionValue<T_Section, K>,
  ): T_Section[K] | undefined {
    if (metaValue.flagKey && this.flags[metaValue.flagKey] !== undefined) {
      return metaValue.parser(this.flags[metaValue.flagKey]);
    }
    return undefined;
  }

  private _getValueFromEnv<T_Section extends object, K extends keyof T_Section>(
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

  private _getValueFromFile<T_Section extends object, K extends keyof T_Section>(
    metaValue: ConfigOptionValue<T_Section, K>,
    useDefaultPath: boolean
  ): T_Section[K] | undefined {
    const pathConfig = useDefaultPath ? metaValue.fileDefaultPath : metaValue.fileConfigPath;
    if (!pathConfig) return undefined;

    if (useDefaultPath && metaValue.isDefaultsSectionProperty) return undefined;

    const valFromFile = typeof pathConfig === 'function'
      ? pathConfig(this.fileCfgFull)
      : getNestedValue(this.fileCfgFull, pathConfig);

    if (valFromFile !== undefined) {
      return metaValue.parser(valFromFile);
    }
    return undefined;
  }

  private _resolveSingleValue<T_Section extends object, K extends keyof T_Section>(
    metaValue: ConfigOptionValue<T_Section, K>,
    hardcodedDefaultForKey: T_Section[K] | undefined
  ): T_Section[K] | undefined {
    let resolvedValue: T_Section[K] | undefined;

    resolvedValue = this._getValueFromCli(metaValue);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = this._getValueFromEnv(metaValue);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = this._getValueFromFile(metaValue, false);
    if (resolvedValue !== undefined) return resolvedValue;

    resolvedValue = this._getValueFromFile(metaValue, true);
    if (resolvedValue !== undefined) return resolvedValue;

    return hardcodedDefaultForKey;
  }

  public buildSection<T_Section extends object>(
    sectionDefaults: Readonly<T_Section>,
    metadata: ConfigMetadata<T_Section>
  ): T_Section {
    const result: Partial<T_Section> = {};
    for (const metaEntry of metadata) {
      const key = metaEntry.key;
      if (metaEntry.isNested) {
        const metaNested = metaEntry;
        const nestedSectionHardcodedDefaults = sectionDefaults[key];
        if (typeof nestedSectionHardcodedDefaults !== 'object' || nestedSectionHardcodedDefaults === null) {
          console.warn(chalk.yellow(`Warning: Default value for nested key '${String(key)}' is not an object in hardcoded defaults. Skipping.`));
          if (typeof sectionDefaults[key] !== 'undefined') {
            result[key] = {} as T_Section[typeof key];
          }
          continue;
        }
        result[key] = this.buildSection(
          nestedSectionHardcodedDefaults as Readonly<Extract<T_Section[typeof key], object>>,
          metaNested.nestedMetadata as ConfigMetadata<Extract<T_Section[typeof key], object>>
        );
      } else {
        const metaValue = metaEntry;
        result[key] = this._resolveSingleValue(
          metaValue,
          sectionDefaults[key]
        );
      }
    }
    return result as T_Section;
  }
}
