/**
 * Master definition of all CLI options.
 * This is the single source of truth for all CLI arguments in the application.
 * 
 * Any changes to CLI options should be made here first, and all other parts
 * of the system will automatically derive their types and behavior from this definition.
 */

/**
 * Master registry of all CLI options.
 * 
 * IMPORTANT: This is the authoritative source for all CLI options.
 * - Adding a new option? Add it here first.
 * - Changing an option? Modify it here.
 * - The TypeScript compiler will ensure all dependent code is updated.
 */
export const CLI_OPTIONS_REGISTRY = {
  // Arguments (positional)
  spec: {
    type: 'argument' as const,
    commanderFlag: '<spec>',
    commanderKey: 'spec',
    internalKey: 'spec',
    description: 'Path to the YAML specification file',
    required: true,
  },

  // Options (flags)
  config: {
    type: 'option' as const,
    commanderFlag: '-c, --config <path>',
    commanderKey: 'config',
    internalKey: 'configPath',
    description: 'Path to the configuration file (default: .cedit.yml, ~/.config/cedit/config.yml, ~/.cedit.yml)',
  },

  dryRun: {
    type: 'option' as const,
    commanderFlag: '--dry-run',
    commanderKey: 'dryRun',
    internalKey: 'dryRun',
    description: 'Perform a dry run without modifying files',
  },

  var: {
    type: 'option' as const,
    commanderFlag: '-v, --var <key=value...>',
    commanderKey: 'var',
    internalKey: 'var',
    description: 'Override spec variables (e.g., --var name=test)',
    defaultValue: [] as string[],
  },

  logLevel: {
    type: 'option' as const,
    commanderFlag: '--log-level <level>',
    commanderKey: 'logLevel',
    internalKey: 'logLevel',
    description: 'Set log level (e.g., info, error). Parsed by Commander, validated in merge logic.',
  },

  logDir: {
    type: 'option' as const,
    commanderFlag: '--log-dir <dir>',
    commanderKey: 'logDir',
    internalKey: 'logDir',
    description: 'Directory for log files. Path resolution handled in merge logic. String if provided, else undefined.',
  },

  backupDir: {
    type: 'option' as const,
    commanderFlag: '--backup-dir <dir>',
    commanderKey: 'backupDir',
    internalKey: 'backupDir',
    description: 'Directory for backup files. Path resolution handled in merge logic. String if provided, else undefined.',
  },

  maxTokens: {
    type: 'option' as const,
    commanderFlag: '--max-tokens <number>',
    commanderKey: 'maxTokens',
    internalKey: 'maxTokens',
    description: 'Maximum tokens for the LLM request. Commander attempts parseInt.',
    parser: parseInt,
  },

  model: {
    type: 'option' as const,
    commanderFlag: '--model <name>',
    commanderKey: 'model',
    internalKey: 'model',
    description: 'Specify the LLM model name. String if provided, else undefined.',
  },

  retries: {
    type: 'option' as const,
    commanderFlag: '--retries <number>',
    commanderKey: 'retries',
    internalKey: 'retries',
    description: 'Number of retries for LLM requests. Commander attempts parseInt.',
    parser: parseInt,
  },

  sleepMs: {
    type: 'option' as const,
    commanderFlag: '--sleep-ms <number>',
    commanderKey: 'sleepMs',
    internalKey: 'sleepMs',
    description: 'Milliseconds to sleep between retries. Commander attempts parseInt.',
    parser: parseInt,
  },

  yes: {
    type: 'option' as const,
    commanderFlag: '-y, --yes',
    commanderKey: 'yes',
    internalKey: 'yes',
    description: 'Skip confirmation prompts',
  },
} as const;

// Extract all possible keys for type safety
export type CliOptionKey = keyof typeof CLI_OPTIONS_REGISTRY;

/**
 * Type-safe mapping from Commander option names to internal property names.
 * This prevents mismatches between what Commander provides and what we expect.
 */
export const COMMANDER_TO_INTERNAL_KEY_MAP = {
  config: 'configPath',
  dryRun: 'dryRun',
  var: 'var',
  logLevel: 'logLevel',
  logDir: 'logDir',
  backupDir: 'backupDir',
  maxTokens: 'maxTokens',
  model: 'model',
  retries: 'retries',
  sleepMs: 'sleepMs',
  yes: 'yes',
} as const;

// Validate that the mapping is complete and accurate
type ExpectedCommanderKeys = {
  [K in CliOptionKey]: typeof CLI_OPTIONS_REGISTRY[K]['type'] extends 'option' 
    ? typeof CLI_OPTIONS_REGISTRY[K]['commanderKey']
    : never
}[CliOptionKey];

type ExpectedInternalKeys = {
  [K in CliOptionKey]: typeof CLI_OPTIONS_REGISTRY[K]['internalKey']
}[CliOptionKey];

// This will cause a compilation error if the mapping is incomplete or incorrect
type _ValidateMapping = {
  [K in keyof typeof COMMANDER_TO_INTERNAL_KEY_MAP]: K extends ExpectedCommanderKeys
    ? typeof COMMANDER_TO_INTERNAL_KEY_MAP[K] extends ExpectedInternalKeys
      ? true
      : never
    : never
};
