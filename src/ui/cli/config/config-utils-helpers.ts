/**
 * Helper functions for configuration utilities
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as fsConstants from 'node:fs';

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
 * Safely converts primitive values to strings
 */
function stringifyPrimitive(value: string | number | boolean | bigint | symbol | undefined | null): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return String(value);
}

/**
 * Safely converts objects to strings
 */
function stringifyObject(value: object): string {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return '[Complex Object]';
  }
}

/**
 * Helper function to safely convert a value to string for log messages
 */
export function safeToString(value: unknown): string {
  if (value === null || value === undefined) {
    return stringifyPrimitive(value);
  }
  
  if (typeof value === 'object') {
    return stringifyObject(value);
  }
  
  return stringifyPrimitive(value as string | number | boolean | bigint | symbol);
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

/**
 * Initialize result object with default values
 */
export function initializeWithDefaults<TSection extends object>(
  sectionDefaults: Readonly<TSection>
): Partial<TSection> {
  const result: Partial<TSection> = {};
  for (const key in sectionDefaults) {
    if (Object.prototype.hasOwnProperty.call(sectionDefaults, key)) {
      result[key] = sectionDefaults[key];
    }
  }
  return result;
}