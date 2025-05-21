import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUS_EVENT_TYPE_INFRA_LOG, type EventBusLogLevel, type EventBusLogPayload } from '#shared/event-bus-types.js';
import { dispatchEvent } from '#shared/event-emitter.js';

/**
 * Numeric log level constants matching Pino's standard levels.
 * These are used to avoid magic numbers and clarify intent.
 * @see https://getpino.io/#/docs/api?id=level-string
 */
export const LOG_LEVEL_FATAL = 60;
export const LOG_LEVEL_ERROR = 50;
export const LOG_LEVEL_WARN = 40;
export const LOG_LEVEL_INFO = 30;
export const LOG_LEVEL_DEBUG = 20;
export const LOG_LEVEL_TRACE = 10;

/**
 * Number of characters for the date prefix in log filenames (YYYY-MM-DD).
 */
const LOGFILE_DATE_LENGTH = 10;

export function createLogFileStream(logDir?: string): fs.WriteStream | null {

  if (logDir === undefined || logDir === '') return null;
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logfile = path.join(
    logDir,
    new Date().toISOString().slice(0, LOGFILE_DATE_LENGTH) + '.log'
  );
  return fs.createWriteStream(logfile, { flags: 'a' });
}

/**
 * Maps a numeric Pino log level to the corresponding event bus log level string.
 * @param pinoLevel - Numeric log level (Pino convention)
 * @returns EventBusLogLevel string
 */
export function mapPinoLevelToEventBusLevel(pinoLevel: number): EventBusLogLevel {
  if (pinoLevel >= LOG_LEVEL_FATAL) return 'fatal';
  if (pinoLevel >= LOG_LEVEL_ERROR) return 'error';
  if (pinoLevel >= LOG_LEVEL_WARN) return 'warn';
  if (pinoLevel >= LOG_LEVEL_INFO) return 'info';
  if (pinoLevel >= LOG_LEVEL_DEBUG) return 'debug';
  return 'trace';
}

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
  const pinoLevelRaw = logData['level'];
  // Use LOG_LEVEL_INFO constant instead of magic number 30
  const pinoLevel = typeof pinoLevelRaw === 'number' ? pinoLevelRaw : LOG_LEVEL_INFO;
  const level: EventBusLogLevel = mapPinoLevelToEventBusLevel(pinoLevel);
  const data: Record<string, unknown> = {};
  for (const key in logData) {
    if (!['msg', 'level', 'time', 'scope'].includes(key)) {
      data[key] = logData[key];
    }
  }
  return {
    timestamp: Date.now(),
    message: typeof logData['msg'] === 'string' ? logData['msg'] : '',
    level,
    scope: typeof logData['scope'] === 'string' ? logData['scope'] : 'app',
    data
  };
}

/**
 * Parses a log chunk (string or buffer) as JSON, returning a plain object or null if parsing fails.
 * The type assertion is justified because JSON.parse always returns object | array | primitive,
 * and we check typeof and null before returning. No safer alternative exists without runtime type guards.
 */
export function parseLogChunk(chunk: unknown): Record<string, unknown> | null {
  try {
    const obj: unknown = JSON.parse(String(chunk));
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

export function emitToEventBus(payload: EventBusLogPayload): void {
  // No-op: recursion guard is now in TypedEventBus.emitTyped
  dispatchEvent(BUS_EVENT_TYPE_INFRA_LOG, payload);
}
