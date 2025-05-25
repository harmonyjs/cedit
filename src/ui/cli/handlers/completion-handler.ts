/**
 * Handles CLI completion events (summary and abort) and provides exit codes.
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { BUS_EVENT_TYPE, type FinishSummaryEvent, type FinishAbortEvent, type bus } from '../../../app/bus/index.js';


export class CompletionHandler {
  private readonly log: Logger;
  private readonly busInstance: typeof bus;
  private summaryHandler?: (payload: FinishSummaryEvent) => void;
  private abortHandler?: (payload: FinishAbortEvent) => void;
  private isListening = false;

  constructor(busInstance: typeof bus, log: Logger) {
    this.busInstance = busInstance;
    this.log = log;
  }

  /**
   * Waits for the application to complete (either via summary or abort) and returns an exit code.
   * @returns A promise that resolves to the exit code (0 for success, 1 for abort/error).
   */
  public awaitCompletion(): Promise<number> {
    if (this.isListening) {
      this.log.warn('Completion handler is already listening.');
      // Potentially return a new promise that resolves when the existing one does,
      // or throw an error, depending on desired behavior for concurrent calls.
      // For now, let's assume it shouldn't be called concurrently and log a warning.
      // This could be an existing promise if we stored it, but for simplicity now, we don't.
    }
    this.isListening = true;
    this.log.debug('Awaiting application completion (summary or abort).');

    // Exit codes for process completion
    const EXIT_CODE_SUCCESS = 0; // Standard POSIX success
    const EXIT_CODE_FAILURE = 1; // Standard POSIX failure

    return new Promise<number>((resolve): void => {
      this.summaryHandler = (payload: FinishSummaryEvent): void => {
        const { totalEdits, filesEdited, filesCreated } = payload.stats;
        const { added, removed, changed } = totalEdits;

        // Summary is already displayed in TUI - only log to console in non-TTY environments
        if (!process.stdout.isTTY) {
          // Console output is necessary for non-TTY environments where TUI is not available
          // eslint-disable-next-line no-restricted-properties
          console.log(
            `\n${chalk.green('✔ Edits Applied:')} ${chalk.greenBright(`+${added}`)} added, ${chalk.redBright(
              `-${removed}`,
            )} removed, ${chalk.yellowBright(`~${changed}`)} changed.`,
          );
          // eslint-disable-next-line no-restricted-properties
          console.log(`${chalk.blue('ℹ Files:')} ${filesEdited} edited, ${filesCreated} created.`);
          /**
           * Number of milliseconds in one second.
           * Used to convert duration from ms to seconds for display.
           */
          const MS_PER_SECOND = 1000;
          /**
           * Number of decimal places to show for duration seconds.
           */
          const DURATION_DECIMALS = 2;
          // eslint-disable-next-line no-restricted-properties
          console.log(`${chalk.gray('⏱ Duration:')} ${(payload.duration / MS_PER_SECOND).toFixed(DURATION_DECIMALS)}s`);
          // eslint-disable-next-line no-restricted-properties
          console.log(chalk.green('✨ All done! ✨'));
        }
        
        this.stopListening();
        resolve(EXIT_CODE_SUCCESS); // Success
      };

      this.abortHandler = (payload: FinishAbortEvent): void => {
        // Log specific message if it's not a core process failure (which is logged elsewhere by other handlers)
        if (!payload.reason.startsWith('Core process failed:')) {
          // Console output is necessary for non-TTY environments where TUI is not available
          if (!process.stdout.isTTY) {
            // eslint-disable-next-line no-restricted-properties
            console.log(chalk.red(`\n✖ Aborted: ${payload.reason}`));
          }
        }
        this.stopListening();
        resolve(EXIT_CODE_FAILURE); // Failure/Abort
      };

      this.busInstance.onceTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, this.summaryHandler);
      this.busInstance.onceTyped(BUS_EVENT_TYPE.FINISH_ABORT, this.abortHandler);
    });
  }

  /**
   * Stops listening for completion events and unregisters handlers.
   */
  public stopListening(): void {
    if (!this.isListening) {
      return;
    }
    this.log.debug('Stopping completion event listeners.');
    if (this.summaryHandler) {
      this.busInstance.offTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, this.summaryHandler);
      // exactOptionalPropertyTypes: true — присваиваем no-op вместо undefined
      this.summaryHandler = (() => undefined) as typeof this.summaryHandler;
    }
    if (this.abortHandler) {
      this.busInstance.offTyped(BUS_EVENT_TYPE.FINISH_ABORT, this.abortHandler);
      this.abortHandler = (() => undefined) as typeof this.abortHandler;
    }
    this.isListening = false;
  }
}
