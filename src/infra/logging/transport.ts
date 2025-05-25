import { Writable } from 'node:stream';
import { pino } from 'pino';
import {
  safeWriteChunkToFile,
  getErrorMessage,
  writeErrorToFile
} from './logging-helpers.js';
import {
  createLogFileStream,
  processLogEvent,
  parseLogChunk,
  emitToEventBus
} from './transport-internal-helpers.js';

/**
 * Configuration options for the event bus transport
 */
export interface TransportOptions {
  /**
   * Directory to store log files. If not provided or empty, no file logging occurs.
   */
  logDir?: string;
  
  /**
   * When true, logs are only sent to the event bus and not written to files.
   * When false, logs are sent to both event bus and files (if logDir is provided).
   */
  eventBusOnly?: boolean;
}

/**
 * Creates a writable stream that processes log events and forwards them to:
 * 1. The application event bus (always)
 * 2. Log files (optional, based on configuration)
 * 
 * @param options - Configuration for the transport
 * @returns A writable stream compatible with Pino
 */
export function createEventBusTransport(options: TransportOptions): Writable {
  let logDir: string | undefined = undefined;
  
  // Only use logDir if it's a non-empty string
  if (typeof options.logDir === 'string' && options.logDir.trim() !== '') {
    logDir = options.logDir;
  }
  
  // Set up file stream if directory is provided
  const fileStream = createLogFileStream(logDir);
  
  // Determine if we should skip file output
  const skipFileOutput = options.eventBusOnly === true;

  return new Writable({
    write(chunk, _encoding, callback): void {
      try {
        // Parse the log chunk
        const logObject = parseLogChunk(chunk);
        if (!logObject) {
          // If invalid log object, still attempt to write to file
          if (!skipFileOutput) {
            writeErrorToFile(fileStream, 'Invalid log object', chunk);
          }
          callback();
          return;
        }
        
        // Process the log event and emit to bus
        const payload = processLogEvent(logObject);
        emitToEventBus(payload);
        
        // Write to file if file output is enabled
        if (!skipFileOutput) {
          safeWriteChunkToFile(fileStream, chunk);
        }
        
        callback();
      } catch (error: unknown) {
        // Handle any errors in the transport
        const errorMsg = getErrorMessage(error);
        if (!skipFileOutput) {
          writeErrorToFile(fileStream, errorMsg, chunk);
        }
        callback();
      }
    }
  });
}

/**
 * Creates a Pino logger that sends logs to the event bus and optionally to files.
 * 
 * @param options - Configuration for the logger
 * @returns A configured Pino logger instance
 */
export function createEventBusLogger(options: {
  level: string;
  logDir?: string;
  eventBusOnly?: boolean;
}): pino.Logger {
  const { level, logDir, eventBusOnly = false } = options;
  
  // Configure Pino options
  const pinoConfig: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: null,
  };
  
  // Set up transport options
  const transportOpts: TransportOptions = { eventBusOnly };
  if (typeof logDir === 'string') {
    transportOpts.logDir = logDir;
  }
  
  // Create and return the logger
  const transport = createEventBusTransport(transportOpts);
  return pino(pinoConfig, transport);
}