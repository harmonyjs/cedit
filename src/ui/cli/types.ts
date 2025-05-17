export interface CliFlags {
  spec: string;
  dry_run: boolean | undefined;
  var: string[];
  log_level: string | undefined;
  log_dir?: string;
  backup_dir?: string;
  max_tokens?: number;
  model?: string;
  retries?: number;
  sleep_ms?: number;
  yes: boolean;
}

export interface CommanderOptionValues {
  dryRun?: boolean;
  var?: string[];
  logLevel?: string;
  logDir?: string;
  backupDir?: string;
  maxTokens?: number;
  model?: string;
  retries?: number;
  sleepMs?: number;
  yes?: boolean;
}
