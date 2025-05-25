import type * as fs from 'node:fs';

/**
 * Logging utility functions that handle common operations when working with log files.
 * These helpers focus on safely handling various input types and edge cases when writing logs.
 */

/**
 * Log level constant for error messages in Pino format
 */
const PINO_LEVEL_ERROR = 50;

/** Returns true if the value is a non-empty string. */
export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

/** Returns true if the value is a non-empty Buffer. */
export function isNonEmptyBuffer(val: unknown): val is Buffer {
  return Buffer.isBuffer(val) && val.length > 0;
}

/**
 * Converts a chunk to a string, handling objects and buffers.
 * 
 * @param chunk - The data to stringify
 * @returns A string representation of the chunk
 */
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

/**
 * Writes a chunk to file, converting to string if needed.
 * 
 * @param fileStream - The file stream to write to
 * @param chunk - The data to write
 */
export function writeChunkToFile(fileStream: fs.WriteStream | null, chunk: unknown): void {
  // Skip if no file stream available
  if (fileStream === null || typeof fileStream.write !== 'function') {
    return;
  }

  // Handle different types of chunks
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

/**
 * Writes a chunk to file, always as a string.
 * 
 * @param fileStream - The file stream to write to
 * @param chunk - The data to write
 */
export function safeWriteChunkToFile(fileStream: fs.WriteStream | null, chunk: unknown): void {
  if (fileStream === null) {
    return;
  }
  
  if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
    writeChunkToFile(fileStream, chunk);
  } else {
    writeChunkToFile(fileStream, String(chunk));
  }
}

/**
 * Extracts a string message from an unknown error value.
 * 
 * @param error - The error to extract a message from
 * @returns A string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'object' && error !== null && 
      'message' in error && typeof error.message === 'string') {
    return error.message;
  } 
  
  if (typeof error === 'string') {
    return error;
  } 
  
  try {
    return JSON.stringify(error);
  } catch {
    return '[Unserializable Error]';
  }
}

/**
 * Writes an error message to file without using the event bus.
 * This is a fallback for when the logging system itself encounters an error.
 * 
 * @param fileStream - The file stream to write to
 * @param error - The error to log
 * @param chunk - The original chunk that caused the error
 */
export function writeErrorToFile(
  fileStream: fs.WriteStream | null, 
  error: unknown,
  chunk: unknown
): void {
  if (fileStream === null) {
    return;
  }

  // Log the original chunk first
  fileStream.write(String(chunk));
  fileStream.write('\n');
  
  // Format and write the error message
  const errorMsg = `Error in log transport: ${getErrorMessage(error)}`;
  fileStream.write(JSON.stringify({
    level: PINO_LEVEL_ERROR,
    time: new Date().toISOString(),
    msg: errorMsg,
    scope: 'logging'
  }));
  fileStream.write('\n');
}