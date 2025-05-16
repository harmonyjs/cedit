/**
 * Event Bus Module
 * 
 * This module provides a central event bus for the application using Node.js's built-in
 * EventEmitter. It allows different parts of the application to communicate without
 * direct dependencies, following a publish-subscribe pattern.
 * 
 * The bus supports three main event namespaces:
 * - init: Emitted when the UI starts, with CliConfig as payload
 * - domain: Emitted for domain events like FileEdited, ErrorRaised, etc.
 * - finish: Emitted when the runner completes, with a summary as payload
 * 
 * Features:
 * - Type-safe event emission and subscription
 * - Event namespacing for better organization
 * - Payload validation
 * - Error handling
 * - Debug mode for logging all events
 * - Integration with the logging system
 */

import { EventEmitter } from 'node:events';
import type { 
  CliConfig, 
  DomainEvent,
  EditStats
} from '../model/index.js';
import { getLogger } from '../../infra/logging/index.js';

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

// ======================================================================
// Event Bus Implementation
// ======================================================================

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

/**
 * Type-safe event bus class that extends Node.js EventEmitter
 */
// Create a minimal default logger configuration for tests
const DEFAULT_LOG_CONFIG = {
  anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-sonnet-20240229',
  retries: 3,
  sleep_between_requests_ms: 1000,
  log: {
    level: 'info' as const,
    dir: '/tmp/cedit/logs',
  },
  backup: {
    dir: '/tmp/cedit/backups',
    keep_for_days: 0,
  },
  defaults: {
    dry_run: false,
    max_tokens: 200000,
    model: 'claude-3-sonnet-20240229', // Added
    retries: 3, // Added
    sleep_between_requests_ms: 1000, // Added
  },
  dry_run: false,
  max_tokens: 200000,
  varsOverride: {},
};

class TypedEventBus extends EventEmitter {
  private logger = getLogger('bus', DEFAULT_LOG_CONFIG);
  private debugMode = false;
  private validationEnabled = true;

  // Make sanitizePayload generic to correctly handle specific event types
  // and ensure it returns Record<string, unknown> for logging.
  private sanitizePayload<T extends BusEventPayload>(payload: T): Record<string, unknown> {
    const result: Record<string, unknown> = { ...payload }; // Shallow copy

    // Example of how to redact sensitive information:
    // Check if 'config' property exists and is an object
    if ('config' in result && result.config && typeof result.config === 'object') {
      const configObj = result.config as Record<string, unknown>; // Cast to work with properties
      if ('anthropic_api_key' in configObj) {
        configObj.anthropic_api_key = '***REDACTED***';
      }
    }
    
    // Also check for top-level anthropic_api_key if it can exist there
    // (based on CliConfig structure which might be part of an event payload)
    if ('anthropic_api_key' in result && typeof result.anthropic_api_key === 'string') {
      result.anthropic_api_key = '***REDACTED***';
    }
    
    return result;
  }

  constructor() {
    super();
    
    // Set maximum listeners to avoid Node.js warning
    this.setMaxListeners(50);
  }
  
  /**
   * Initialize the logger with a specific config
   * This should be called as early as possible in the application lifecycle
   */
  public initLogger(config: CliConfig): void {
    this.logger = getLogger('bus', config);
    this.logger.info('Event Bus logger initialized with config');
  }

  /**
   * Enable or disable debug mode
   * When enabled, all events will be logged
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable payload validation
   */
  public setValidation(enabled: boolean): void {
    this.validationEnabled = enabled;
    this.logger.info(`Validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set the maximum number of listeners
   */
  public setMaxListenersCount(count: number): void {
    this.setMaxListeners(count);
    this.logger.debug(`Max listeners set to ${count}`);
  }

  /**
   * Type-safe method to emit an event
   */
  public emitTyped<T_EVENT extends BusEventTypeValue>(
    eventType: T_EVENT,
    payload: EventTypeToPayloadMap[T_EVENT]
  ): boolean {
    try {
      // Add timestamp if not present
      if (!('timestamp' in payload)) {
        (payload as BusEventBase).timestamp = Date.now();
      }

      // Validate payload if enabled
      if (this.validationEnabled) {
        this.validatePayload(eventType, payload);
      }

      // Log event in debug mode
      if (this.debugMode) {
        this.logger.debug({ 
          event: eventType, 
          // Pass the specific payload type to the generic sanitizePayload
          payload: this.sanitizePayload(payload)
        }, 'Event emitted');
      }

      // Emit to specific event type
      const specificResult = super.emit(eventType, payload);
      
      // Also emit to namespace for wildcard listeners
      const namespace = eventType.split(':')[0] as BusNamespaceType;
      const namespaceResult = super.emit(`${namespace}:*`, eventType, payload);
      
      // Emit to global wildcard
      const wildcardResult = super.emit('*', eventType, payload);
      
      return specificResult || namespaceResult || wildcardResult;
    } catch (error) {
      this.logger.error({ 
        event: eventType, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Error emitting event');
      
      // Re-throw in development, swallow in production
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Type-safe method to subscribe to an event
   */
  public onTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (_payload: EventTypeToPayloadMap[T]) => void
  ): this {
    super.on(eventType, listener);
    return this;
  }

  /**
   * Subscribe to all events in a namespace using wildcard
   */
  public onNamespace<T extends BusNamespaceType>(
    namespace: T,
    listener: (_eventType: string, _payload: BusEventPayload) => void
  ): this {
    super.on(`${namespace}:*`, listener);
    return this;
  }

  /**
   * Subscribe to all events using global wildcard
   */
  public onAny(
    listener: (_eventType: string, _payload: BusEventPayload) => void
  ): this {
    super.on('*', listener);
    return this;
  }

  /**
   * Type-safe method to subscribe to an event once
   */
  public onceTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (_payload: EventTypeToPayloadMap[T]) => void
  ): this {
    super.once(eventType, listener);
    return this;
  }

  /**
   * Type-safe method to unsubscribe from an event
   */
  public offTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (payload: EventTypeToPayloadMap[T]) => void
  ): this {
    super.off(eventType, listener);
    return this;
  }

  /**
   * Remove all listeners for testing purposes
   */
  public clearAllListeners(): this {
    this.removeAllListeners();
    this.logger.warn('All event listeners have been removed');
    return this;
  }

  private _validateInitPayload(
    eventType: BusEventTypeValue,
    payload: InitConfigEvent | InitCompleteEvent
  ): void {
    if (eventType === BusEventType.INIT_CONFIG) {
      const typedPayload = payload as InitConfigEvent;
      if (!typedPayload.config) {
        throw new Error(`Invalid payload for ${eventType}: config is required`);
      }
    }
    // INIT_COMPLETE has no specific required fields other than what BusEventBase might require
    // and that it exists, which is checked before calling this.
  }

  private _validateDomainPayload(
    eventType: BusEventTypeValue,
    payload: DomainEventWrapper
  ): void {
    if (!payload.event || !payload.event.type) {
      throw new Error(
        `Invalid payload for ${eventType}: event with type is required`
      );
    }
  }

  private _validateFinishPayload(
    eventType: BusEventTypeValue,
    payload: FinishSummaryEvent | FinishAbortEvent
  ): void {
    if (eventType === BusEventType.FINISH_SUMMARY) {
      const typedPayload = payload as FinishSummaryEvent;
      if (!typedPayload.stats) {
        throw new Error(`Invalid payload for ${eventType}: stats is required`);
      }
    } else if (eventType === BusEventType.FINISH_ABORT) {
      const typedPayload = payload as FinishAbortEvent;
      if (!typedPayload.reason) {
        throw new Error(`Invalid payload for ${eventType}: reason is required`);
      }
    }
  }

  /**
   * Validate event payload
   */
  private validatePayload<T extends BusEventTypeValue>(
    eventType: T,
    payload: EventTypeToPayloadMap[T]
  ): void {
    // Basic validation
    if (!payload) {
      throw new Error(
        `Invalid payload for event ${eventType}: payload is required`
      );
    }

    // Delegate to specific validators based on namespace
    if (eventType.startsWith(BusNamespace.INIT)) {
      this._validateInitPayload(
        eventType,
        payload as InitConfigEvent | InitCompleteEvent
      );
    } else if (eventType.startsWith(BusNamespace.DOMAIN)) {
      this._validateDomainPayload(eventType, payload as DomainEventWrapper);
    } else if (eventType.startsWith(BusNamespace.FINISH)) {
      this._validateFinishPayload(
        eventType,
        payload as FinishSummaryEvent | FinishAbortEvent
      );
    }
    // No default case needed as eventType is constrained by BusEventTypeValue
    // and all namespaces are covered.
  }
}

/**
 * The singleton instance of the event bus
 * This is the central communication hub for the application
 */
export const bus = new TypedEventBus();

// ======================================================================
// Helper Functions
// ======================================================================

/**
 * Helper function to emit an init:config event
 */
export function emitInitConfig(config: CliConfig): boolean {
  return bus.emitTyped(BusEventType.INIT_CONFIG, { timestamp: Date.now(), config });
}

/**
 * Helper function to emit a domain event
 */
export function emitDomainEvent(event: DomainEvent): boolean {
  // Map domain event type to bus event type
  let eventType: BusEventTypeValue;
  
  switch (event.type) {
    case 'FileViewed':
      eventType = BusEventType.DOMAIN_FILE_VIEWED;
      break;
    case 'FileEdited':
      eventType = BusEventType.DOMAIN_FILE_EDITED;
      break;
    case 'FileCreated':
      eventType = BusEventType.DOMAIN_FILE_CREATED;
      break;
    case 'BackupCreated':
      eventType = BusEventType.DOMAIN_BACKUP_CREATED;
      break;
    case 'ErrorRaised':
      eventType = BusEventType.DOMAIN_ERROR;
      break;
    default:
      throw new Error(`Unknown domain event type: ${Object.prototype.toString.call(event)}`);
  }
  
  return bus.emitTyped(eventType, { timestamp: Date.now(), event });
}

/**
 * Helper function to emit a finish:summary event
 */
export function emitFinishSummary(
  stats: FinishSummaryEvent['stats'],
  duration: number
): boolean {
  return bus.emitTyped(BusEventType.FINISH_SUMMARY, {
    timestamp: Date.now(),
    stats,
    duration
  });
}

/**
 * Helper function to emit a finish:abort event
 */
export function emitFinishAbort(reason: string, code?: string): boolean {
  return bus.emitTyped(BusEventType.FINISH_ABORT, {
    timestamp: Date.now(),
    reason,
    code
  });
}