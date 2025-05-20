/**
 * Storage infrastructure for cedit CLI tool
 * 
 * This module provides safe, testable file-system helpers for reading, writing,
 * backup and diff-statistics. These helpers will be called by `app/editor` and
 * never by UI directly.
 * 
 * It isolates all disk I/O operations in one place, making them easy to audit,
 * swap (e.g., to a database), and test.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { getLogger } from '../logging/index.js';
import type { CliConfig, ReplaceCommand as ReplaceUse, InsertCommand as InsertUse, EditStats } from '../../app/model/index.js';

// Logger will be initialized when needed with the provided config
let log: ReturnType<typeof getLogger>;

/**
 * Initialize the logger with the provided config.
 * This should be called before any other function in this module.
 */
export function initStorage(config: CliConfig): void {
  log = getLogger('storage', config);
}

/** Ensure a user-supplied relative path stays inside CWD. */
export function toAbsoluteSafe(relPath: string): string {
  const abs = path.resolve(process.cwd(), relPath);
  if (!abs.startsWith(process.cwd())) {
    throw new Error(`Path escapes workspace: ${relPath}`);
  }
  return abs;
}

/** Read file as UTF-8, returns array of lines. */
export async function readFileLines(relPath: string): Promise<string[]> {
  const abs = toAbsoluteSafe(relPath);
  const data = await fs.readFile(abs, 'utf8');
  if (typeof log !== 'undefined' && log !== null) log.info({ relPath }, 'file read'); // strict-boolean-expressions
  return data.split(/\r?\n/);
}

/**
 * Write content to file (overwrites) and return lines count.
 * If dryRun is true, writes to <file>.updated.<ext> instead.
 */
export async function writeFile(
  relPath: string,
  content: string,
  cfg: CliConfig
): Promise<number> {
  const target = (cfg.dryRun ?? false) // Handle nullish case for dryRun
    ? relPath.replace(/(\.[^./]+)$/i, '.updated$1') // add .updated before ext
    : relPath;
  const abs = toAbsoluteSafe(target);
  
  // Ensure directory exists
  const dir = path.dirname(abs);
  // Check if dir is not an empty string before creating
  if (typeof dir === 'string' && dir !== '') {
    await fs.mkdir(dir, { recursive: true });
  }
  
  await fs.writeFile(abs, content, 'utf8');
  if (typeof log !== 'undefined' && log !== null) log.info({ target }, 'file written'); // strict-boolean-expressions
  return content.split(/\r?\n/).length;
}

export async function makeBackup(relPath: string, cfg: CliConfig): Promise<string> {
  const abs = toAbsoluteSafe(relPath);
  const stamp = Date.now();
  const destDir = path.join(cfg.backup.dir, path.dirname(relPath));
  // Check if destDir is not an empty string before creating
  if (typeof destDir === 'string' && destDir !== '') {
    await fs.mkdir(destDir, { recursive: true });
  }
  const dest = path.join(destDir, path.basename(relPath) + '.' + stamp + '.bak');
  await fs.copyFile(abs, dest);
  if (typeof log !== 'undefined' && log !== null) log.info({ dest }, 'backup created'); // strict-boolean-expressions
  return dest;
}

/** Quick line-level diff counters (no external lib). */
export function lineStats(oldLines: string[], newLines: string[]): EditStats {
  let added = 0, removed = 0, changed = 0;
  const len = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < len; i++) {
    const a = oldLines[i];
    const b = newLines[i];
    if (a === undefined) added++;
    else if (b === undefined) removed++;
    else if (a !== b) changed++;
  }
  return { added, removed, changed } as const;
}

// explicit-function-return-type / explicit-module-boundary-types
export async function applyReplace(cmd: ReplaceUse, cfg: CliConfig): Promise<Readonly<{ type: 'FileEdited'; path: string; lines: number; stats: EditStats }>> {
  const oldLines = await readFileLines(cmd.path);
  await makeBackup(cmd.path, cfg);
  const before = oldLines.slice(0, cmd.lineFrom);
  const after = oldLines.slice(cmd.lineTo + 1);
  const next = [...before, cmd.content, ...after].join('\n');
  const newCount = await writeFile(cmd.path, next, cfg);
  const stats = lineStats(oldLines, next.split(/\r?\n/));
  // Return an object that matches the FileEdited event type in the model
  return { 
    type: 'FileEdited', 
    path: cmd.path, 
    lines: newCount,
    stats
  } as const;
}

// explicit-function-return-type / explicit-module-boundary-types
export async function applyInsert(cmd: InsertUse, cfg: CliConfig): Promise<Readonly<{ type: 'FileEdited'; path: string; lines: number; stats: EditStats }>> {
  const oldLines = await readFileLines(cmd.path);
  await makeBackup(cmd.path, cfg);
  const nextLines = [...oldLines];
  nextLines.splice(cmd.after + 1, 0, cmd.content);
  const next = nextLines.join('\n');
  const newCount = await writeFile(cmd.path, next, cfg);
  const stats = lineStats(oldLines, nextLines);
  // Return an object that matches the FileEdited event type in the model
  return { 
    type: 'FileEdited', 
    path: cmd.path, 
    lines: newCount,
    stats
  } as const;
}