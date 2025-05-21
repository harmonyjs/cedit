/**
 * TUI Log Handler
 * 
 * This module subscribes to log events from the event bus and displays them
 * using Clack. It ensures that all logging output is controlled by the TUI
 * and maintained in a consistent, user-friendly format.
 */

import { log } from '@clack/prompts';
import chalk from 'chalk';
import { bus, BUS_EVENT_TYPE } from '../../app/bus/index.js';


// Maximum number of properties to show inline
const MAX_INLINE_PROPERTIES = 2;

/**
 * Formats a log scope for display
 */
function formatScope(scope: string): string {
  return chalk.gray(`[${scope}]`);
}

/**
 * Formats log data as a string
 */
function formatData(data: Record<string, unknown> | undefined): string {
  if (data === undefined || Object.keys(data).length === 0) {
    return '';
  }

  // Extract error message if present
  if ('error' in data && data['error'] !== undefined) {
    const errorVal = data['error'];
    const errorStr = typeof errorVal === 'string'
      ? errorVal
      : errorVal instanceof Error
        ? errorVal.message
        : JSON.stringify(errorVal);
    return chalk.red(errorStr);
  }

  // For simple data with few properties, inline them
  if (Object.keys(data).length <= MAX_INLINE_PROPERTIES) {
    return Object.entries(data)
      .map(([key, value]) => `${chalk.gray(key)}=${
        typeof value === 'string' ? value : JSON.stringify(value)
      }`)
      .join(' ');
  }

  // Otherwise serialize to JSON
  return JSON.stringify(data);
}


/**
 * Initialize the TUI log handler
 * 
 * This function subscribes to INFRA_LOG events and displays them using Clack
 */
export function initLogHandler(): void {
  bus.onTyped(BUS_EVENT_TYPE.INFRA_LOG, handleInfraLogEvent);
}

/**
 * Handles an INFRA_LOG event payload and routes it to the correct log method.
 * Split into smaller functions for SRP and complexity reduction.
 */
function handleInfraLogEvent(payload: unknown): void {
  if (!process.stdout.isTTY) {
    return;
  }
  // Defensive: check payload shape
  if (!isEventBusLogPayload(payload)) {
    return;
  }
  const message: unknown = payload.message;
  const level: string = String(payload.level);
  const scope: unknown = payload.scope;
  const data: unknown = payload.data;

  const scopeStr = typeof scope === 'string' ? formatScope(scope) : '';
  const dataStr = isRecord(data) ? formatData(data) : '';
  const safeMessage = getSafeMessage(message);
  const safeDataStr = typeof dataStr === 'string' ? dataStr : JSON.stringify(dataStr);
  const logMessage = [safeMessage, safeDataStr].filter(Boolean).join(' ');
  routeLog(level, scopeStr, logMessage);
}

/**
 * Type guard for EventBusLogPayload shape.
 */
function isEventBusLogPayload(val: unknown): val is { message: unknown; level: unknown; scope?: unknown; data?: unknown } {
  return (
    val !== null &&
    typeof val === 'object' &&
    'message' in val &&
    'level' in val
  );
}


/**
 * Returns a safe string message from any input.
 * Handles string, Error, and unknown types.
 */
function getSafeMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

/**
 * Routes the log to the appropriate Clack log method based on level.
 */
function routeLog(level: string, scopeStr: string, logMessage: string): void {
  switch (level) {
    case 'fatal':
    case 'error':
      log.error(`${scopeStr} ${logMessage}`);
      break;
    case 'warn':
      log.warn(`${scopeStr} ${logMessage}`);
      break;
    case 'info':
      log.info(`${scopeStr} ${logMessage}`);
      break;
    case 'debug':
    case 'trace':
      if (process.env['NODE_ENV'] === 'development') {
        log.info(`${chalk.gray('debug')} ${scopeStr} ${logMessage}`);
      }
      break;
    default:
      log.info(`${scopeStr} ${logMessage}`);
      break;
  }
}

/**
 * Type guard for Record<string, unknown>
 */

function isRecord(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}
