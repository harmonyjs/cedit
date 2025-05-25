import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUS_EVENT_TYPE_INFRA_LOG, type EventBusLogLevel, type EventBusLogPayload } from '#shared/event-bus-types.js';
import { dispatchEvent } from '#shared/event-emitter.js';

/**
 * Numeric log level constants matching Pino's standard levels.
 * These are used to avoid magic numbers and clarify intent.
 * @see https://getpino.io/#/docs/api?id=level-string
 */
export const LOG_LEVELS = {
  FATAL: 60,
  ERROR: 50,
  WARN: 40,
  INFO: 30,
  DEBUG: 20,
  TRACE: 10
} as const;

/**
 * Number of characters for the date prefix in log filenames (YYYY-MM-DD).
 */
const LOGFILE_DATE_LENGTH = 10;

/**
 * The keys that should be excluded from the data field in the event bus payload
 */
const RESERVED_LOG_KEYS = ['msg', 'level', 'time', 'scope'];

/**
 * Creates a write stream for the log file if a directory is provided.
 * The filename is based on the current date.
 *
 * @param logDir - Directory to store log files
 * @returns A WriteStream or null if no directory is provided
 */
export function createLogFileStream(logDir?: string): fs.WriteStream | null {
  // Explicitly check for undefined, null, or empty string
  if (logDir === undefined || logDir === null || logDir === '') {
    return null;
  }
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Create a log file named with the current date (YYYY-MM-DD.log)
  const datePart = new Date().toISOString().slice(0, LOGFILE_DATE_LENGTH);
  const logfile = path.join(logDir, `${datePart}.log`);
  
  return fs.createWriteStream(logfile, { flags: 'a' });
}

/**
 * Maps a numeric Pino log level to the corresponding event bus log level string.
 *
 * @param pinoLevel - Numeric log level (Pino convention)
 * @returns EventBusLogLevel string
 */
export function mapPinoLevelToEventBusLevel(pinoLevel: number): EventBusLogLevel {
  if (pinoLevel >= LOG_LEVELS.FATAL) return 'fatal';
  if (pinoLevel >= LOG_LEVELS.ERROR) return 'error';
  if (pinoLevel >= LOG_LEVELS.WARN) return 'warn';
  if (pinoLevel >= LOG_LEVELS.INFO) return 'info';
  if (pinoLevel >= LOG_LEVELS.DEBUG) return 'debug';
  return 'trace';
}

/**
 * Processes a log event and converts it to the event bus payload format
 *
 * @param logData - The raw log data from Pino
 * @returns Formatted payload for the event bus
 */
export function processLogEvent(logData: Record<string, unknown>): EventBusLogPayload {
  if (typeof logData !== 'object' || logData === null) {
    return {
      timestamp: Date.now(),
      message: '',
      level: 'info',
      scope: 'app',
      data: {}
    };
  }
  
  // Get the numeric level from Pino and convert it to our level format
  const pinoLevelRaw = logData['level'];
  const pinoLevel = typeof pinoLevelRaw === 'number' ? pinoLevelRaw : LOG_LEVELS.INFO;
  const level = mapPinoLevelToEventBusLevel(pinoLevel);
  
  // Extract the message and scope
  const message = typeof logData['msg'] === 'string' ? logData['msg'] : '';
  const scope = typeof logData['scope'] === 'string' ? logData['scope'] : 'app';
  
  // Extract all other fields that aren't reserved as data
  const data: Record<string, unknown> = {};
  for (const key in logData) {
    if (!RESERVED_LOG_KEYS.includes(key)) {
      data[key] = logData[key];
    }
  }
  
  return {
    timestamp: Date.now(),
    message,
    level,
    scope,
    data: Object.keys(data).length > 0 ? data : {}
  };
}

/**
 * Parses a log chunk (string or buffer) as JSON, returning a plain object or null if parsing fails.
 * The type assertion is justified because JSON.parse always returns object | array | primitive,
 * and we check typeof and null before returning. No safer alternative exists without runtime type guards.
 */
export function parseLogChunk(chunk: unknown): Record<string, unknown> | null {
  try {
    const str = typeof chunk === 'string' ? chunk : String(chunk);
    const obj: unknown = JSON.parse(str);

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      // Type assertion is necessary here because JSON.parse returns unknown,
      // and we have checked for object and non-null. Further runtime validation would be overkill.
      // Attempted to use type guards and generics, but due to dynamic log structure, assertion is required.
      // See: https://github.com/microsoft/TypeScript/issues/21732
      return obj as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Dispatches a log event to the event bus
 *
 * @param payload - The log payload to emit
 */
export function emitToEventBus(payload: EventBusLogPayload): void {
  // No-op: recursion guard is now in TypedEventBus.emitTyped
  dispatchEvent(BUS_EVENT_TYPE_INFRA_LOG, payload);
}
