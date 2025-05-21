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

export interface TransportOptions {
  logDir?: string;
  eventBusOnly?: boolean;
}

export function createEventBusTransport(options: TransportOptions): Writable {
  let logDir: string | undefined = undefined;
  if (typeof options.logDir === 'string' && options.logDir.trim() !== '') {
    logDir = options.logDir;
  }
  const fileStream = createLogFileStream(logDir);

  return new Writable({
    write(chunk, _encoding, callback): void {
      try {
        const logObject = parseLogChunk(chunk);
        if (!logObject) {
          writeErrorToFile(fileStream, 'Invalid log object', chunk);
          callback();
          return;
        }
        const payload = processLogEvent(logObject);
        emitToEventBus(payload);
        safeWriteChunkToFile(fileStream, chunk);
        callback();
      } catch (error: unknown) {
        const errorMsg = getErrorMessage(error);
        writeErrorToFile(fileStream, errorMsg, chunk);
        callback();
      }
    }
  });
}

export function createEventBusLogger(options: {
  level: string;
  logDir?: string;
  eventBusOnly?: boolean;
}): pino.Logger {
  const { level, logDir, eventBusOnly = false } = options;
  const pinoConfig: pino.LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: null,
  };
  const transportOpts: { logDir?: string; eventBusOnly?: boolean } = { eventBusOnly };
  if (typeof logDir === 'string') transportOpts.logDir = logDir;
  const transport = createEventBusTransport(transportOpts);
  return pino(pinoConfig, transport);
}