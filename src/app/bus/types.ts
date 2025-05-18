import type { 
  CliConfig, 
  DomainEvent,
  EditStats
} from '../model/index.js';

// ======================================================================
// Event Types and Namespaces
// ======================================================================

/**
 * Event namespaces for better organization
 */
export const BusNamespace = {
  INIT: 'init',
  DOMAIN: 'domain',
  FINISH: 'finish',
} as const;

export type BusNamespaceType = typeof BusNamespace[keyof typeof BusNamespace];

/**
 * Event types within each namespace
 */
export const BusEventType = {
  // Init events
  INIT_CONFIG: `${BusNamespace.INIT}:config`,
  INIT_COMPLETE: `${BusNamespace.INIT}:complete`,
  
  // Domain events
  DOMAIN_FILE_VIEWED: `${BusNamespace.DOMAIN}:file-viewed`,
  DOMAIN_FILE_EDITED: `${BusNamespace.DOMAIN}:file-edited`,
  DOMAIN_FILE_CREATED: `${BusNamespace.DOMAIN}:file-created`,
  DOMAIN_BACKUP_CREATED: `${BusNamespace.DOMAIN}:backup-created`,
  DOMAIN_ERROR: `${BusNamespace.DOMAIN}:error`,
  
  // Finish events
  FINISH_SUMMARY: `${BusNamespace.FINISH}:summary`,
  FINISH_ABORT: `${BusNamespace.FINISH}:abort`,
} as const;

export type BusEventTypeValue = typeof BusEventType[keyof typeof BusEventType];

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
  | FinishAbortEvent;

/**
 * Type mapping between event types and their payload types
 */
export interface EventTypeToPayloadMap {
  [BusEventType.INIT_CONFIG]: InitConfigEvent;
  [BusEventType.INIT_COMPLETE]: InitCompleteEvent;
  [BusEventType.DOMAIN_FILE_VIEWED]: DomainEventWrapper;
  [BusEventType.DOMAIN_FILE_EDITED]: DomainEventWrapper;
  [BusEventType.DOMAIN_FILE_CREATED]: DomainEventWrapper;
  [BusEventType.DOMAIN_BACKUP_CREATED]: DomainEventWrapper;
  [BusEventType.DOMAIN_ERROR]: DomainEventWrapper;
  [BusEventType.FINISH_SUMMARY]: FinishSummaryEvent;
  [BusEventType.FINISH_ABORT]: FinishAbortEvent;
}
