import { bus } from './instance.js';
import {
  BUS_EVENT_TYPE,
  type BusEventTypeValue,
  type FinishSummaryEvent
} from './types.js';
import type { CliConfig, DomainEvent } from '../model/index.js';
import type { EventBusLogPayload } from '#shared/event-bus-types.js';

/**
 * Helper function to emit an init:config event
 */
export function emitInitConfig(config: CliConfig): boolean {
  return bus.emitTyped(BUS_EVENT_TYPE.INIT_CONFIG, { timestamp: Date.now(), config });
}

/**
 * Handles unknown domain event types by throwing an appropriate error.
 * @param event - The event object to inspect.
 */
function handleUnknownDomainEvent(event: unknown): never {
  if (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    typeof (event as { type?: unknown }).type === 'string'
  ) {
    throw new Error(`Unknown domain event type: ${(event as { type: string }).type}`);
  } else if (event instanceof Error) {
    throw new Error(`Unknown domain event (passed as Error object): ${event.message}`);
  } else {
    throw new Error('Unknown domain event structure or non-string type property');
  }
}

/**
 * Helper function to emit a domain event.
 * The 'event' parameter is of type DomainEvent. ESLint can flag this as
 * 'unsafe-assignment' if the DomainEvent union includes types that are, or contain,
 * error objects (e.g., ErrorRaisedEvent). This directive addresses that issue.
 */
 
export function emitDomainEvent(event: DomainEvent): boolean {
  let eventType: BusEventTypeValue;

  switch (event.type) {
    case 'FileViewed':
      eventType = BUS_EVENT_TYPE.DOMAIN_FILE_VIEWED;
      break;
    case 'FileEdited':
      eventType = BUS_EVENT_TYPE.DOMAIN_FILE_EDITED;
      break;
    case 'FileCreated':
      eventType = BUS_EVENT_TYPE.DOMAIN_FILE_CREATED;
      break;
    case 'BackupCreated':
      eventType = BUS_EVENT_TYPE.DOMAIN_BACKUP_CREATED;
      break;
    case 'ErrorRaised':
      eventType = BUS_EVENT_TYPE.DOMAIN_ERROR;
      break;
    default:
      handleUnknownDomainEvent(event as unknown);
  }

  // The 'event' object is passed as part of the payload.
  return bus.emitTyped(eventType, { timestamp: Date.now(), event });
}

/**
 * Helper function to emit an infrastructure log event
 */
export function emitInfraLog(payload: EventBusLogPayload): boolean {
  return bus.emitTyped(BUS_EVENT_TYPE.INFRA_LOG, payload);
}

/**
 * Helper function to emit a finish:summary event
 */
export function emitFinishSummary(
  stats: FinishSummaryEvent['stats'],
  duration: number
): boolean {
  return bus.emitTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, {
    timestamp: Date.now(),
    stats,
    duration
  });
}

/**
 * Helper function to emit a finish:abort event
 */
// exactOptionalPropertyTypes: true требует, чтобы опциональные поля были явно undefined
export function emitFinishAbort(reason: string, code?: string): boolean {
  return bus.emitTyped(BUS_EVENT_TYPE.FINISH_ABORT, {
    timestamp: Date.now(),
    reason,
    ...(code !== undefined ? { code } : {})
  });
}
