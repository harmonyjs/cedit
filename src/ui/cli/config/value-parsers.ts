/**
 * Value parsing utilities for CLI configuration.
 */
import path from 'node:path';
import type { CliConfig } from '../../../app/model/index.js'; // Adjusted path

/**
 * Parses a YAML string value.
 * @param val The value to parse.
 * @returns The string if valid, otherwise undefined.
 */
export function parseYamlString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

/**
 * Parses a value and resolves it as an absolute path.
 * @param val The value to parse.
 * @returns The resolved absolute path if valid, otherwise undefined.
 */
export function parseAndResolvePath(val: unknown): string | undefined {
  if (typeof val === 'string' && val.trim() !== '') {
    return path.resolve(val.trim());
  }
  return undefined;
}

/**
 * Parses a YAML boolean value.
 * Accepts: true/false, 'true'/'false' (case-insensitive), 1/0, '1'/'0'.
 * @param val The value to parse.
 * @returns The boolean if valid, otherwise undefined.
 */
export function parseYamlBoolean(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
  }
  return undefined;
}

/**
 * Parses a YAML number value.
 * @param val The value to parse.
 * @returns The number if valid and not NaN, otherwise undefined.
 */
export function parseYamlNumber(val: unknown): number | undefined {
  if (typeof val === 'number') {
    return !isNaN(val) ? val : undefined;
  }
  if (typeof val === 'string') {
    const n = Number(val);
    return !isNaN(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Parses a log level string.
 * Expected levels are 'info' or 'error' as per CliConfig.
 * @param val The value to parse.
 * @returns The log level if valid, otherwise undefined.
 */
export function parseLogLevel(val: unknown): CliConfig['log']['level'] | undefined {
  if (typeof val === 'string' && (val === 'info' || val === 'error')) {
    return val;
  }
  return undefined;
}
