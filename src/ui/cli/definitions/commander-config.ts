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
      if ('parser' in definition && typeof definition.parser !== 'undefined') {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description, definition.parser);
      } else if ('defaultValue' in definition && typeof definition.defaultValue !== 'undefined') {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description, definition.defaultValue);
      } else {
        configuredProgram = configuredProgram.option(definition.commanderFlag, definition.description);
      }
    }
  }
  
  return configuredProgram;
}

/**
 * Validates that all required arguments are present.
 */
function validateRequiredArguments(args: string[]): string[] {
  const errors: string[] = [];
  
  for (const [optionKey, definition] of Object.entries(CLI_OPTIONS_REGISTRY)) {
    if (definition.type === 'argument' && 'required' in definition && Boolean(definition.required)) {
      if (args.length === 0 || args[0] === undefined || args[0] === '') {
        errors.push(`Required argument '${optionKey}' is missing`);
      }
    }
  }
  
  return errors;
}

/**
 * Validates that all required options are present.
 */
function validateRequiredOptionValues(opts: Record<string, unknown>): string[] {
  const errors: string[] = [];
  
  for (const [, definition] of Object.entries(CLI_OPTIONS_REGISTRY)) {
    if (definition.type === 'option' && 'required' in definition && Boolean(definition.required)) {
      const key = definition.commanderKey;
      const value = opts[key];
      if (!(key in opts) || value === undefined) {
        errors.push(`Required option '${definition.commanderFlag}' is missing`);
      }
    }
  }
  
  return errors;
}

/**
 * Validates that all required options from the definition are present in Commander opts.
 * This provides runtime validation that complements the compile-time type safety.
 */
export function validateRequiredOptions(opts: Record<string, unknown>, args: string[]): void {
  const argumentErrors = validateRequiredArguments(args);
  const optionErrors = validateRequiredOptionValues(opts);
  const errors = [...argumentErrors, ...optionErrors];
  
  if (errors.length !== 0) {
    throw new Error(`Missing required CLI options:\n${errors.join('\n')}`);
  }
}
