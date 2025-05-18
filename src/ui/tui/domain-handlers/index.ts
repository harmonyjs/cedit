import chalk from 'chalk';
import { log } from '@clack/prompts';
import type { DomainEvent } from '../../../app/model/index.js';

export function handleFileViewedEvent(event: Extract<DomainEvent, { type: 'FileViewed' }>, activeSpinner: { stop: (msg: string) => void } | null): void {
  if (!process.stdout.isTTY) return;
  if (activeSpinner) {
    activeSpinner.stop(`Viewed ${chalk.cyan(event.path)}`);
  } else {
    log.info(`Viewed ${chalk.cyan(event.path)} (${event.lines} lines)`);
  }
}

export function handleFileEditedEvent(event: Extract<DomainEvent, { type: 'FileEdited' }>): void {
  if (!process.stdout.isTTY) return;
  if (event.stats) {
    const { added, removed, changed } = event.stats;
    log.success(`Edited ${chalk.cyan(event.path)}: ${chalk.green(`+${added}`)} ${chalk.red(`-${removed}`)} ${chalk.yellow(`~${changed}`)}`);
  } else {
    log.success(`Edited ${chalk.cyan(event.path)}`);
  }
}

export function handleFileCreatedEvent(event: Extract<DomainEvent, { type: 'FileCreated' }>): void {
  if (!process.stdout.isTTY) return;
  log.success(`Created ${chalk.cyan(event.path)} (${event.lines} lines)`);
}

export function handleBackupCreatedEvent(event: Extract<DomainEvent, { type: 'BackupCreated' }>): void {
  if (!process.stdout.isTTY) return;
  log.info(`Backup created: ${chalk.gray(event.originalPath)} → ${chalk.gray(event.backupPath)}`);
}

export function handleErrorRaisedEvent(event: Extract<DomainEvent, { type: 'ErrorRaised' }>, activeSpinner: { stop: (msg: string) => void } | null): void {
  if (!process.stdout.isTTY) return;
  if (activeSpinner) {
    activeSpinner.stop(chalk.red(`Error: ${event.message}`));
  } else {
    log.error(`Error: ${chalk.red(event.message)}`);
  }
}
