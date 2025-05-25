/**
 * Type-safe CLI option registry and utilities.
 * This provides a centralized way to manage CLI options with compile-time safety.
 * 
 * IMPORTANT: This is the single source of truth for ALL CLI options.
 * - To add a new CLI option: Add it to CLI_OPTION_DEFINITIONS
 * - The TypeScript compiler will enforce that all parts of the system are updated
 * - Any undefined options will cause compilation errors
 */

/**
 * Master definition of each CLI option with full metadata.
 * This is the authoritative source that drives everything else.
 */
export const CLI_OPTION_DEFINITIONS = {
  // Arguments (positional)
  spec: {
    type: 'argument' as const,
    commanderFlag: '<spec>',
    commanderKey: null, // Arguments don't have commander keys
    internalKey: 'spec' as const,
    description: 'Path to the YAML specification file',
    required: true,
  },
  
  // Options (flags)
  config: {
    type: 'option' as const,
    commanderFlag: '-c, --config <path>',
    commanderKey: 'config' as const,
    internalKey: 'configPath' as const,
    description: 'Path to the configuration file',
    required: false,
  },
  
  dryRun: {
    type: 'option' as const,
    commanderFlag: '--dry-run',
    commanderKey: 'dryRun' as const,
    internalKey: 'dryRun' as const,
    description: 'Perform a dry run without modifying files',
    required: false,
  },
  
  var: {
    type: 'option' as const,
    commanderFlag: '-v, --var <key=value...>',
    commanderKey: 'var' as const,
    internalKey: 'var' as const,
    description: 'Override spec variables (e.g., --var name=test)',
    required: false,
    defaultValue: [] as string[],
  },
  
  logLevel: {
    type: 'option' as const,
    commanderFlag: '--log-level <level>',
    commanderKey: 'logLevel' as const,
    internalKey: 'logLevel' as const,
    description: 'Set log level (e.g., info, error)',
    required: false,
  },
  
  logDir: {
    type: 'option' as const,
    commanderFlag: '--log-dir <dir>',
    commanderKey: 'logDir' as const,
    internalKey: 'logDir' as const,
    description: 'Directory for log files',
    required: false,
  },
  
  backupDir: {
    type: 'option' as const,
    commanderFlag: '--backup-dir <dir>',
    commanderKey: 'backupDir' as const,
    internalKey: 'backupDir' as const,
    description: 'Directory for backup files',
    required: false,
  },
  
  maxTokens: {
    type: 'option' as const,
    commanderFlag: '--max-tokens <number>',
    commanderKey: 'maxTokens' as const,
    internalKey: 'maxTokens' as const,
    description: 'Maximum tokens for the LLM request',
    required: false,
    parser: parseInt as (value: string) => number,
  },
  
  model: {
    type: 'option' as const,
    commanderFlag: '--model <name>',
    commanderKey: 'model' as const,
    internalKey: 'model' as const,
    description: 'Specify the LLM model name',
    required: false,
  },
  
  retries: {
    type: 'option' as const,
    commanderFlag: '--retries <number>',
    commanderKey: 'retries' as const,
    internalKey: 'retries' as const,
    description: 'Number of retries for LLM requests',
    required: false,
    parser: parseInt as (value: string) => number,
  },
  
  sleepMs: {
    type: 'option' as const,
    commanderFlag: '--sleep-ms <number>',
    commanderKey: 'sleepMs' as const,
    internalKey: 'sleepMs' as const,
    description: 'Milliseconds to sleep between retries',
    required: false,
    parser: parseInt as (value: string) => number,
  },
  
  yes: {
    type: 'option' as const,
    commanderFlag: '-y, --yes',
    commanderKey: 'yes' as const,
    internalKey: 'yes' as const,
    description: 'Skip confirmation prompts',
    required: false,
  },
} as const;

/**
 * Derived registries for backward compatibility and convenience
 */
export const CLI_OPTION_REGISTRY = {
  // Commander option names (what Commander.js provides in opts)
  COMMANDER_KEYS: Object.fromEntries(
    Object.entries(CLI_OPTION_DEFINITIONS)
      .filter(([, def]) => def.type === 'option' && def.commanderKey !== null)
      .map(([, def]) => [def.commanderKey as string, def.commanderKey as string])
  ),
  
  // Internal property names (what we use in CliFlags)
  INTERNAL_KEYS: Object.fromEntries(
    Object.entries(CLI_OPTION_DEFINITIONS)
      .map(([, def]) => [def.internalKey, def.internalKey])
  ),
  
  // Mapping from Commander keys to internal keys
  KEY_MAPPING: Object.fromEntries(
    Object.entries(CLI_OPTION_DEFINITIONS)
      .filter(([, def]) => def.type === 'option' && def.commanderKey !== null)
      .map(([, def]) => [def.commanderKey as string, def.internalKey])
  ),
} as const;

// Type definitions derived from the registry
export type CliOptionDefinition = typeof CLI_OPTION_DEFINITIONS[keyof typeof CLI_OPTION_DEFINITIONS];
export type CommanderKey = NonNullable<CliOptionDefinition['commanderKey']>;
export type InternalKey = CliOptionDefinition['internalKey'];

/**
 * Type-safe function to get internal key from commander key.
 * This will cause a compilation error if the key doesn't exist in our mapping.
 */
export function getInternalKey<K extends CommanderKey>(commanderKey: K): string {
  const mapping = CLI_OPTION_REGISTRY.KEY_MAPPING as Record<CommanderKey, string>;
  const result = mapping[commanderKey];
  if (result === undefined) {
    throw new Error(`No internal key mapping found for commander key: ${commanderKey}`);
  }
  return result;
}

/**
 * Type-safe function to validate a commander key exists in our registry.
 */
export function isValidCommanderKey(key: string): key is CommanderKey {
  return key in CLI_OPTION_REGISTRY.KEY_MAPPING;
}

/**
 * Get all valid commander keys as an array.
 */
export function getValidCommanderKeys(): CommanderKey[] {
  return Object.keys(CLI_OPTION_REGISTRY.KEY_MAPPING) as CommanderKey[];
}

/**
 * Get option definition by commander key.
 */
export function getOptionDefinition(commanderKey: CommanderKey): CliOptionDefinition {
  const definition = Object.values(CLI_OPTION_DEFINITIONS)
    .find(def => def.commanderKey === commanderKey);
  if (!definition) {
    throw new Error(`No definition found for commander key: ${commanderKey}`);
  }
  return definition;
}

/**
 * Get all option definitions as an array.
 */
export function getAllOptionDefinitions(): CliOptionDefinition[] {
  return Object.values(CLI_OPTION_DEFINITIONS);
}

/**
 * Get only option definitions (excludes arguments).
 */
export function getOptionDefinitions(): CliOptionDefinition[] {
  return Object.values(CLI_OPTION_DEFINITIONS).filter(def => def.type === 'option');
}

/**
 * Get only argument definitions.
 */
export function getArgumentDefinitions(): CliOptionDefinition[] {
  return Object.values(CLI_OPTION_DEFINITIONS).filter(def => def.type === 'argument');
}
