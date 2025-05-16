/**
 * Handles CLI completion events (summary and abort) and provides exit codes.
 */
import chalk from 'chalk';
import type { Logger } from 'pino';
import { bus, BusEventType, type FinishSummaryEvent, type FinishAbortEvent } from '../../../app/bus/index.js'; // Adjusted path

export class CompletionHandler { // Renamed class
  private log: Logger;
  private busInstance: typeof bus;
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

    return new Promise<number>((resolve) => {
      this.summaryHandler = (payload: FinishSummaryEvent) => {
        const { totalEdits, filesEdited, filesCreated } = payload.stats;
        const { added, removed, changed } = totalEdits;

        // Log to console, not logger, as this is user-facing summary
        console.log(
          `\n${chalk.green('✔ Edits Applied:')} ${chalk.greenBright(`+${added}`)} added, ${chalk.redBright(
            `-${removed}`,
          )} removed, ${chalk.yellowBright(`~${changed}`)} changed.`,
        );
        console.log(`${chalk.blue('ℹ Files:')} ${filesEdited} edited, ${filesCreated} created.`);
        console.log(`${chalk.gray('⏱ Duration:')} ${(payload.duration / 1000).toFixed(2)}s`);
        console.log(chalk.green('✨ All done! ✨'));
        
        this.stopListening();
        resolve(0); // Success
      };

      this.abortHandler = (payload: FinishAbortEvent) => {
        // Log specific message if it's not a core process failure (which is logged elsewhere by other handlers)
        if (!payload.reason.startsWith('Core process failed:')) {
          // Log to console, not logger, as this is user-facing
          console.log(chalk.red(`\n✖ Aborted: ${payload.reason}`));
        }
        this.stopListening();
        resolve(1); // Failure/Abort
      };

      this.busInstance.onceTyped(BusEventType.FINISH_SUMMARY, this.summaryHandler);
      this.busInstance.onceTyped(BusEventType.FINISH_ABORT, this.abortHandler);
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
      this.busInstance.offTyped(BusEventType.FINISH_SUMMARY, this.summaryHandler);
      this.summaryHandler = undefined;
    }
    if (this.abortHandler) {
      this.busInstance.offTyped(BusEventType.FINISH_ABORT, this.abortHandler);
      this.abortHandler = undefined;
    }
    this.isListening = false;
  }
}
