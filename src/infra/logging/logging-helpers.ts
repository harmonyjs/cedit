import type * as fs from 'node:fs';

/** Returns true if the value is a non-empty string. */
export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

/** Returns true if the value is a non-empty Buffer. */
export function isNonEmptyBuffer(val: unknown): val is Buffer {
  return Buffer.isBuffer(val) && val.length > 0;
}

/** Converts a chunk to a string, handling objects and buffers. */
export function stringifyChunk(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString();
  if (typeof chunk === 'object' && chunk !== null) {
    try {
      return JSON.stringify(chunk);
    } catch {
      return '[Unserializable Object]';
    }
  }
  return String(chunk);
}

/** Writes a chunk to file, converting to string if needed. */
export function writeChunkToFile(fileStream: fs.WriteStream | null, chunk: unknown): void {
  if (fileStream !== null && typeof fileStream.write === 'function') {
    if (isNonEmptyString(chunk) || isNonEmptyBuffer(chunk)) {
      fileStream.write(stringifyChunk(chunk));
      fileStream.write('\n');
    } else if (chunk !== null && chunk !== undefined) {
      const str = stringifyChunk(chunk);
      if (str.length > 0) {
        fileStream.write(str);
        fileStream.write('\n');
      }
    }
  }
}

/** Writes a chunk to file, always as a string. */
export function safeWriteChunkToFile(fileStream: fs.WriteStream | null, chunk: unknown): void {
  if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
    writeChunkToFile(fileStream, chunk);
  } else {
    writeChunkToFile(fileStream, String(chunk));
  }
}

/** Extracts a string message from an unknown error value. */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  } else if (typeof error === 'string') {
    return error;
  } else {
    try {
      return JSON.stringify(error);
    } catch {
      return '[Unserializable Error]';
    }
  }
}

/** Writes an error message to file without using the event bus. */
export function writeErrorToFile(
  fileStream: fs.WriteStream | null, 
  error: unknown,
  chunk: unknown
): void {
  if (fileStream === null) {
    return;
  }
  fileStream.write(String(chunk));
  fileStream.write('\n');
  const errorMsg = `Error in log transport: ${error instanceof Error ? error.message : String(error)}`;
  fileStream.write(JSON.stringify({
    level: 50, // PINO_LEVEL_ERROR
    time: new Date().toISOString(),
    msg: errorMsg,
    scope: 'logging'
  }));
  fileStream.write('\n');
}