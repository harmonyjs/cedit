import type { 
  CliConfig, 
  DomainEvent,
  EditStats
} from '../model/index.js';
// Import both the value and the type in the same line
// Merged import for both value and type from the same module to avoid duplication
import { BUS_EVENT_TYPE_INFRA_LOG, type EventBusLogPayload } from '#shared/event-bus-types.js';

// ======================================================================
// Event Types and Namespaces
// ======================================================================

/**
 * Event namespaces for better organization
 */
export const BUS_NAMESPACE = {
  INIT: 'init',
  DOMAIN: 'domain',
  FINISH: 'finish',
  INFRA: 'infra', // Added infrastructure namespace for logs
} as const;

export type BusNamespaceType = typeof BUS_NAMESPACE[keyof typeof BUS_NAMESPACE];

/**
 * Event types within each namespace
 */
export const BUS_EVENT_TYPE = {
  // Init events
  INIT_CONFIG: `${BUS_NAMESPACE.INIT}:config`,
  INIT_COMPLETE: `${BUS_NAMESPACE.INIT}:complete`,
  
  // Domain events
  DOMAIN_FILE_VIEWED: `${BUS_NAMESPACE.DOMAIN}:file-viewed`,
  DOMAIN_FILE_EDITED: `${BUS_NAMESPACE.DOMAIN}:file-edited`,
  DOMAIN_FILE_CREATED: `${BUS_NAMESPACE.DOMAIN}:file-created`,
  DOMAIN_BACKUP_CREATED: `${BUS_NAMESPACE.DOMAIN}:backup-created`,
  DOMAIN_ERROR: `${BUS_NAMESPACE.DOMAIN}:error`,
  
  // Finish events
  FINISH_SUMMARY: `${BUS_NAMESPACE.FINISH}:summary`,
  FINISH_ABORT: `${BUS_NAMESPACE.FINISH}:abort`,
  
  // Infrastructure events
  INFRA_LOG: BUS_EVENT_TYPE_INFRA_LOG,
} as const;

export type BusEventTypeValue = typeof BUS_EVENT_TYPE[keyof typeof BUS_EVENT_TYPE];

// ======================================================================
// Event Payload Types
// ======================================================================

/**
 * Base interface for all event payloads
 */
export interface BusEventBase {
  timestamp: number;
}

/**
 * Init event payloads
 */
export interface InitConfigEvent extends BusEventBase {
  config: CliConfig;
}

export interface InitCompleteEvent extends BusEventBase {
  success: boolean;
  message?: string;
}

/**
 * Domain event payloads - reusing existing domain model types
 */
export interface DomainEventWrapper extends BusEventBase {
  event: DomainEvent;
}

/**
 * Finish event payloads
 */
export interface FinishSummaryEvent extends BusEventBase {
  stats: {
    filesEdited: number;
    filesCreated: number;
    backupsCreated: number;
    totalEdits: EditStats;
  };
  duration: number; // milliseconds
}

export interface FinishAbortEvent extends BusEventBase {
  reason: string;
  code?: string;
}

/**
 * Union type of all possible event payloads
 */
export type BusEventPayload = 
  | InitConfigEvent
  | InitCompleteEvent
  | DomainEventWrapper
  | FinishSummaryEvent
  | FinishAbortEvent
  | EventBusLogPayload;

/**
 * Type mapping between event types and their payload types
 */
// The following type mapping is required for event-to-payload resolution in the event bus implementation.
export type EventTypeToPayloadMap = {
  [BUS_EVENT_TYPE.INIT_CONFIG]: InitConfigEvent;
  [BUS_EVENT_TYPE.INIT_COMPLETE]: InitCompleteEvent;
  [BUS_EVENT_TYPE.DOMAIN_FILE_VIEWED]: DomainEventWrapper;
  [BUS_EVENT_TYPE.DOMAIN_FILE_EDITED]: DomainEventWrapper;
  [BUS_EVENT_TYPE.DOMAIN_FILE_CREATED]: DomainEventWrapper;
  [BUS_EVENT_TYPE.DOMAIN_BACKUP_CREATED]: DomainEventWrapper;
  [BUS_EVENT_TYPE.DOMAIN_ERROR]: DomainEventWrapper;
  [BUS_EVENT_TYPE.FINISH_SUMMARY]: FinishSummaryEvent;
  [BUS_EVENT_TYPE.FINISH_ABORT]: FinishAbortEvent;
  [BUS_EVENT_TYPE.INFRA_LOG]: EventBusLogPayload;
};
