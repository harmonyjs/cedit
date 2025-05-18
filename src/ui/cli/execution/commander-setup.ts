import { Command } from 'commander';
import { getVersion } from '../services/version-manager.js';

export async function setupCommander(): Promise<Command> {
  const version = await getVersion();
  const program = new Command('cedit')
    .version(version)
    .argument('<spec>', 'Path to the YAML specification file')
    .option('--dry-run', 'Perform a dry run without modifying files')
    .option(
      '-v, --var <key=value...>',
      'Override spec variables (e.g., --var name=test)',
      [],
    )
    .option(
      '--log-level <level>',
      'Set log level (e.g., info, error). Parsed by Commander, validated in merge logic.',
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
      parseInt,
    )
    .option('--model <name>', 'Specify the LLM model name. String if provided, else undefined.')
    .option(
      '--retries <number>',
      'Number of retries for LLM requests. Commander attempts parseInt.',
      parseInt,
    )
    .option(
      '--sleep-ms <number>',
      'Milliseconds to sleep between retries. Commander attempts parseInt.',
      parseInt,
    )
    .option('-y, --yes', 'Skip confirmation prompts');
  return program;
}
