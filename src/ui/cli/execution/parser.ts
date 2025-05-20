/**
 * CLI argument parsing utilities
 */

import type { Command } from 'commander';
import type { CliFlags, CommanderOptionValues } from '../types.js';
import chalk from 'chalk';
import { setupCommander } from './commander-setup.js';

/**
 * Helper to normalize string CLI options.
 * Returns the string if present, otherwise an empty string.
 * @param value Option value
 */
function getStringOpt(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Helper to normalize number CLI options.
 * Returns the number if valid, otherwise 0.
 * @param value Option value
 */
function getNumberOpt(value: unknown): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

/**
 * Helper to normalize boolean CLI options.
 * Returns the boolean value if it's a boolean, undefined otherwise.
 * This preserves the distinction between explicitly set false and not set at all.
 * @param value Option value
 */
function getBooleanOpt(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Helper to normalize boolean CLI options that require a default value.
 * Returns the boolean value if it's a boolean, false otherwise.
 * @param value Option value
 */
function getRequiredBooleanOpt(value: unknown): boolean {
  return value === true;
}

/**
 * Validates critical CLI flags required for the application to run.
 * If validation fails, it prints help and throws an error.
 * @param flags Parsed CLI flags.
 * @param program Commander program instance for printing help.
 * @throws Error if critical flags are missing.
 */
function validateCriticalFlags(flags: CliFlags, program: Command): void {
  if (flags.spec === '' || flags.spec === undefined) {
    console.error(chalk.red('Error: Spec file path is required.'));
    program.help(); // This is the crucial part that needs the program instance
    // unreachable throw removed for TS7027
  }
}

export async function parseArguments( // Renamed function
  argv: string[],
): Promise<{ flags: CliFlags; program: Command }> {
  // const version = await getVersion(); // Moved to setupCommander
  const program = await setupCommander(); // Use the setup function

  program.parse(argv);

  const opts: CommanderOptionValues = program.opts();
  const args = program.args;

  const flags: CliFlags = {
    spec: getStringOpt(args[0]),
    dryRun: getBooleanOpt(opts.dryRun),
    var: opts.var || [],
    logLevel: opts.logLevel,
    logDir: getStringOpt(opts.logDir),
    backupDir: getStringOpt(opts.backupDir),
    maxTokens: getNumberOpt(opts.maxTokens),
    model: getStringOpt(opts.model),
    retries: getNumberOpt(opts.retries),
    sleepMs: getNumberOpt(opts.sleepMs),
    yes: getRequiredBooleanOpt(opts.yes),
  };

  // Perform critical flag validation immediately after parsing and constructing flags
  validateCriticalFlags(flags, program);

  return { flags, program };
}
