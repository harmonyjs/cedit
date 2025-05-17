/**
 * Monitors and displays CLI progress based on domain events.
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { bus, BusEventType, BusNamespace } from '../../../app/bus/index.js'; // Adjusted path

/**
 * Interface for progress information.
 */
export interface ProgressInfo {
  viewed: number;
  edited: number;
  errors: number;
}

export class ProgressMonitor { // Renamed class
  private log: Logger;
  private busInstance: typeof bus;
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
  public start(intervalMs = 5000): void {
    if (this.isMonitoring) {
      this.log.warn('Progress monitor is already running.');
      return;
    }

    this.log.debug('Starting progress monitor.');
    this.fileViewedCount = 0;
    this.fileEditedCount = 0;
    this.errorCount = 0;

    this.domainEventListener = (eventType: string) => {
      if (eventType === BusEventType.DOMAIN_FILE_VIEWED) {
        this.fileViewedCount++;
      } else if (eventType === BusEventType.DOMAIN_FILE_EDITED) {
        this.fileEditedCount++;
      } else if (eventType === BusEventType.DOMAIN_ERROR) {
        this.errorCount++;
      }
    };
    this.busInstance.onNamespace(BusNamespace.DOMAIN, this.domainEventListener);

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
      this.busInstance.off(`\${BusNamespace.DOMAIN}:*`, this.domainEventListener);
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
