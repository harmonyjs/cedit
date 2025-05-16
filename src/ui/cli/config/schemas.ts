/**
 * Zod schemas for validating the structure of configuration files (e.g., cedit.yml).
 */
import { z } from 'zod'; // Assuming zod is available in the project

// Schema for LogConfig parts that can be defined in the config file
export const LogConfigSchema = z.object({
  level: z.enum(['info', 'error']).optional(),
  dir: z.string().trim().min(1).optional(), // Ensure dir is a non-empty string if provided
});

// Schema for BackupConfig parts that can be defined in the config file
export const BackupConfigSchema = z.object({
  dir: z.string().trim().min(1).optional(), // Ensure dir is a non-empty string if provided
  keep_for_days: z.number().int().min(0).optional(),
});

// Schema for the 'defaults' section within the config file.
// These are settings that can have their default values specified in the config file's 'defaults' block.
export const FileBasedDefaultConfigSchema = z.object({
  dry_run: z.boolean().optional(),
  max_tokens: z.number().int().positive().optional(),
  model: z.string().trim().min(1).optional(),
  retries: z.number().int().min(0).optional(),
  sleep_between_requests_ms: z.number().int().min(0).optional(),
  // Note: log and backup defaults for specific properties (e.g. defaults.log.level)
  // are handled by direct paths in CONFIG_METADATA, not by nesting full LogConfigSchema here.
}).strict(); // Disallow unknown keys in the 'defaults' section

// Schema for the overall structure of the config file (e.g., cedit.yml)
// This represents what can be parsed from the file, which is a subset of the full CliConfig.
export const PartialCliConfigFromFileSchema = z.object({
  anthropic_api_key: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  retries: z.number().int().min(0).optional(),
  sleep_between_requests_ms: z.number().int().min(0).optional(),
  log: LogConfigSchema.optional(),
  backup: BackupConfigSchema.optional(),
  defaults: FileBasedDefaultConfigSchema.optional(),
  dry_run: z.boolean().optional(),
  max_tokens: z.number().int().positive().optional(),
  // varsOverride is not set in the config file; it's sourced from CLI flags.
}).strict(); // Disallow unknown top-level keys in the config file.

// Type inferred from the schema, representing the validated structure from a config file.
export type PartialCliConfigFromFile = z.infer<typeof PartialCliConfigFromFileSchema>;
