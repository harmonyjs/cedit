/**
 * Monitors and displays CLI progress based on domain events.
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { BUS_EVENT_TYPE, BUS_NAMESPACE, type bus } from '../../../app/bus/index.js';

/**
 * Interface for progress information.
 */
export interface ProgressInfo {
  viewed: number;
  edited: number;
  errors: number;
}

// Time constants in milliseconds
const FIVE_SECONDS_MS = 5000;

export class ProgressMonitor {
  /**
   * Default progress update interval in milliseconds.
   */
  private static readonly DEFAULT_PROGRESS_INTERVAL_MS = FIVE_SECONDS_MS;
  private readonly log: Logger;
  private readonly busInstance: typeof bus;
  private progressIntervalId?: NodeJS.Timeout;
  private fileViewedCount = 0;
  private fileEditedCount = 0;
  private errorCount = 0;
  private domainEventListener?: (eventType: string) => void;
  private isMonitoring = false;

  constructor(busInstance: typeof bus, log: Logger) {
    this.busInstance = busInstance;
    this.log = log;
  }

  /**
   * Starts monitoring domain events and displaying progress periodically.
   * @param intervalMs - The interval in milliseconds for displaying progress.
   */
  public start(intervalMs: number = ProgressMonitor.DEFAULT_PROGRESS_INTERVAL_MS): void {
    if (this.isMonitoring) {
      this.log.warn('Progress monitor is already running.');
      return;
    }

    this.log.debug('Starting progress monitor.');
    // Reset progress counters
    this.fileViewedCount = 0;
    this.fileEditedCount = 0;
    this.errorCount = 0;

    this.domainEventListener = (eventType: string): void => {
      if (eventType === BUS_EVENT_TYPE.DOMAIN_FILE_VIEWED) {
        this.fileViewedCount++;
      } else if (eventType === BUS_EVENT_TYPE.DOMAIN_FILE_EDITED) {
        this.fileEditedCount++;
      } else if (eventType === BUS_EVENT_TYPE.DOMAIN_ERROR) {
        this.errorCount++;
      }
    };
    
    this.busInstance.onNamespace(BUS_NAMESPACE.DOMAIN, this.domainEventListener);

    this.progressIntervalId = setInterval(() => {
      const progress = this.getProgress();
      // Log to console, not logger, as this is user-facing progress
      console.log(
        `Progress: ${chalk.yellow(progress.viewed)} files viewed, ${chalk.green(
          progress.edited,
        )} edited, ${chalk.red(progress.errors)} errors`,
      );
    }, intervalMs);
    this.isMonitoring = true;
  }

  /**
   * Stops monitoring domain events and displaying progress.
   */
  public stop(): void {
    if (!this.isMonitoring) {
      return;
    }
    this.log.debug('Stopping progress monitor.');
    if (this.progressIntervalId) {
      clearInterval(this.progressIntervalId);
      this.progressIntervalId = undefined;
    }
    if (this.domainEventListener) {
      this.busInstance.off(`${BUS_NAMESPACE.DOMAIN}:*`, this.domainEventListener);
      this.domainEventListener = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Gets the current progress information.
   * @returns The current progress.
   */
  public getProgress(): ProgressInfo {
    return {
      viewed: this.fileViewedCount,
      edited: this.fileEditedCount,
      errors: this.errorCount,
    };
  }
}
