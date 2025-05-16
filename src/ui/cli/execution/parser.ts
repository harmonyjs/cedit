/**
 * CLI argument parsing utilities
 */
import { Command } from 'commander';
import type { CliFlags, CommanderOptionValues } from '../main.js'; // Adjusted path
import chalk from 'chalk';
import { getVersion } from '../services/version-manager.js'; // Adjusted path and function name

/**
 * Validates critical CLI flags required for the application to run.
 * If validation fails, it prints help and throws an error.
 * @param flags Parsed CLI flags.
 * @param program Commander program instance for printing help.
 * @throws Error if critical flags are missing.
 */
function _validateCriticalFlags(flags: CliFlags, program: Command): void {
  if (!flags.spec) {
    console.error(chalk.red('Error: Spec file path is required.'));
    program.help(); // This is the crucial part that needs the program instance
    throw new Error('Spec file path is required.');
  }
}

export async function parseArguments( // Renamed function
  argv: string[],
): Promise<{ flags: CliFlags; program: Command }> {
  const version = await getVersion(); // Adjusted function name
  const program = new Command('cedit')
    .version(version)
    .argument('<spec>', 'Path to the YAML specification file')
    // For boolean flags, Commander sets them to true if present, false if --no-<flag> is used, undefined otherwise.
    // We want to distinguish between explicitly set false and not set at all, so we don't provide a default here.
    .option('--dry-run', 'Perform a dry run without modifying files')
    .option(
      '-v, --var <key=value...>',
      'Override spec variables (e.g., --var name=test)',
      [], // Default for repeatable options is an empty array
    )
    .option(
      '--log-level <level>',
      'Set log level (e.g., info, error). Parsed by Commander, validated in merge logic.',
      // No default here, allows merge logic to pick from file or hardcoded default if not provided.
      // If provided, it's a string; otherwise, undefined.
    )
    .option(
      '--log-dir <dir>',
      'Directory for log files. Path resolution handled in merge logic. String if provided, else undefined.'
    )
    .option(
      '--backup-dir <dir>',
      'Directory for backup files. Path resolution handled in merge logic. String if provided, else undefined.'
    )
    .option(
      '--max-tokens <number>',
      'Maximum tokens for the LLM request. Commander attempts parseInt.',
      parseInt, // Commander will call this if the option is provided. Result is number or NaN.
    )
    .option('--model <name>', 'Specify the LLM model name. String if provided, else undefined.')
    .option(
      '--retries <number>',
      'Number of retries for LLM requests. Commander attempts parseInt.',
      parseInt, // Result is number or NaN.
    )
    .option(
      '--sleep-ms <number>',
      'Milliseconds to sleep between retries. Commander attempts parseInt.',
      parseInt, // Result is number or NaN.
    )
    // Boolean flag, true if present, undefined otherwise (as no default is specified by us here for --yes).
    .option('-y, --yes', 'Skip confirmation prompts');

  program.parse(argv);

  const opts: CommanderOptionValues = program.opts();
  const args = program.args;

  const flags: CliFlags = {
    spec: typeof args[0] === 'string' ? args[0] : '', // spec is a required argument by Commander
    // dry_run: Commander sets to true if --dry-run, false if --no-dry-run, undefined otherwise.
    // This matches CliFlags.dry_run: boolean | undefined.
    dry_run: opts.dryRun,
    var: opts.var || [], // Commander provides empty array if not set, due to our default []
    // For options with potential defaults or file overrides, we pass them as potentially undefined.
    // Commander passes the string value if provided, or undefined if not (unless a Commander default was set).
    log_level: opts.logLevel, // Matches CliFlags.log_level: string | undefined
    log_dir: opts.logDir, // string | undefined
    backup_dir: opts.backupDir, // string | undefined
    // For numeric options, convert NaN from parseInt to undefined.
    // This simplifies downstream logic, which only needs to check for undefined.
    max_tokens: Number.isNaN(opts.maxTokens) ? undefined : opts.maxTokens,
    model: opts.model, // string | undefined
    retries: Number.isNaN(opts.retries) ? undefined : opts.retries, // number | undefined (or NaN)
    sleep_ms: Number.isNaN(opts.sleepMs) ? undefined : opts.sleepMs, // number | undefined (or NaN)
    // yes: Commander sets to true if --yes, undefined otherwise (as we didn't set a default for it in program.option).
    yes: !!opts.yes, // Coerced to boolean (true if --yes is present, false otherwise). Matches CliFlags.yes: boolean.
  };

  // Perform critical flag validation immediately after parsing and constructing flags
  _validateCriticalFlags(flags, program);

  return { flags, program };
}
