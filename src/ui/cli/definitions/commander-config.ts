/**
 * Type-safe Commander.js setup generator.
 * This automatically configures Commander.js based on CLI option definitions.
 */

import type { Command } from 'commander';
import { CLI_OPTIONS_REGISTRY } from './cli-option-definitions.js';

/**
 * Automatically configures a Commander program with all defined CLI options.
 * This ensures that all options from CLI_OPTIONS_REGISTRY are properly set up.
 */
export function configureCommanderOptions(program: Command): Command {
  let configuredProgram = program;
  
  // Add arguments first
  for (const [, definition] of Object.entries(CLI_OPTIONS_REGISTRY)) {
    if (definition.type === 'argument') {
      configuredProgram = configuredProgram.argument(definition.commanderFlag, definition.description);
    }
  }
  
  // Then add options
  for (const [, definition] of Object.entries(CLI_OPTIONS_REGISTRY)) {
    if (definition.type === 'option') {
      if ('parser' in definition && definition.parser) {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description, definition.parser);
      } else if ('defaultValue' in definition && definition.defaultValue !== undefined) {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description, definition.defaultValue);
      } else {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description);
      }
    }
  }
  
  return configuredProgram;
}

/**
 * Validates that all required options from the definition are present in Commander opts.
 * This provides runtime validation that complements the compile-time type safety.
 */
export function validateRequiredOptions(opts: Record<string, unknown>, args: string[]): void {
  const errors: string[] = [];
  
  for (const [optionKey, definition] of Object.entries(CLI_OPTIONS_REGISTRY)) {
    if ('required' in definition && definition.required) {
      if (definition.type === 'argument') {
        // For arguments, check args array
        if (args.length === 0 || args[0] === undefined || args[0] === '') {
          errors.push(`Required argument '${optionKey}' is missing`);
        }
      } else {
        // For options, check opts object
        if (opts[definition.commanderKey] === undefined) {
          errors.push(`Required option '${definition.commanderFlag}' is missing`);
        }
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Missing required CLI options:\n${errors.join('\n')}`);
  }
}
