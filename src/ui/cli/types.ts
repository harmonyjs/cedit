export interface CliFlags {
  spec: string;
  dryRun: boolean | undefined;
  var: string[];
  logLevel: string | undefined;
  logDir: string;
  backupDir: string;
  maxTokens: number;
  model: string;
  retries: number;
  sleepMs: number;
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
