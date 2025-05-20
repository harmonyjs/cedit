/**
 * Validation helper functions for configuration loading
 */

import chalk from 'chalk';
import type { ZodIssue, ZodError } from 'zod';

/**
 * Returns true if the validation result is a failure.
 */
export function isValidationFailure(result: unknown): result is { success: false; error: ZodError } {
  return (
    typeof result === 'object' && 
    result !== null && 
    'success' in result && 
    result.success === false
  );
}

/**
 * Logs validation issues to the console.
 */
export function logValidationIssues(error: ZodError, filePath: string): void {
  console.warn(chalk.yellow(`Warning: Configuration file at ${filePath} has validation errors:`));
  error.issues.forEach((issue: ZodIssue) => {
    console.warn(chalk.yellow(`  - Path: ${issue.path.join('.')}, Message: ${issue.message}`));
  });
}

/**
 * Returns true if the error is not an ENOENT error.
 */
export function isNonEnoentError(error: unknown): boolean {
  return error instanceof Error && 
         'code' in error && 
         typeof (error as { code: unknown }).code === 'string' && 
         (error as { code: string }).code !== 'ENOENT';
}

/**
 * Returns true if the error is an ENOENT error.
 */
export function isEnoentError(error: unknown): boolean {
  return error instanceof Error && 
         'code' in error && 
         typeof (error as { code: unknown }).code === 'string' && 
         (error as { code: string }).code === 'ENOENT';
}
