import { Command } from 'commander';
import { getVersion } from '../services/version-manager.js';
import { getOptionDefinitions, getArgumentDefinitions } from '../definitions/registry.js';

export async function setupCommander(): Promise<Command> {
  const version = await getVersion();
  const program = new Command('cedit').version(version);

  // Add arguments from registry
  const argumentDefinitions = getArgumentDefinitions();
  for (const arg of argumentDefinitions) {
    program.argument(arg.commanderFlag, arg.description);
  }

  // Add options from registry
  const optionDefinitions = getOptionDefinitions();
  for (const option of optionDefinitions) {
    if ('parser' in option && option.parser !== undefined) {
      program.option(option.commanderFlag, option.description, option.parser);
    } else if ('defaultValue' in option && option.defaultValue !== undefined) {
      program.option(option.commanderFlag, option.description, option.defaultValue);
    } else {
      program.option(option.commanderFlag, option.description);
    }
  }

  return program;
}
