import { EventEmitter } from 'node:events';
import type { CliConfig } from '../model/index.js';
import { getLogger } from '../../infra/logging/index.js';
import {
  type BusNamespaceType,
  type BusEventTypeValue,
  type BusEventBase,
  type BusEventPayload,
  type EventTypeToPayloadMap
} from './types.js';
import { validatePayload } from './payload-validator.js';

const DEFAULT_LOG_CONFIG = {
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
  model: 'claude-3-sonnet-20240229',
  retries: 3,
  sleepBetweenRequestsMs: 1000,
  log: {
    level: 'info' as const,
    dir: '/tmp/cedit/logs',
  },
  backup: {
    dir: '/tmp/cedit/backups',
    keepForDays: 0,
  },
  defaults: {
    dryRun: false,
    maxTokens: 200000,
    model: 'claude-3-sonnet-20240229',
    retries: 3,
    sleepBetweenRequestsMs: 1000,
  },
  dryRun: false,
  maxTokens: 200000,
  varsOverride: {},
};

const DEFAULT_MAX_LISTENERS = 50;

export class TypedEventBus extends EventEmitter {
  private logger = getLogger('bus', DEFAULT_LOG_CONFIG);
  private debugMode = false;
  private validationEnabled = true;

  constructor() {
    super();
    this.setMaxListeners(DEFAULT_MAX_LISTENERS);
  }

  public initLogger(config: CliConfig): void {
    this.logger = getLogger('bus', config);
    this.logger.info('Event Bus logger initialized with config');
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  public setValidation(enabled: boolean): void {
    this.validationEnabled = enabled;
    this.logger.info(`Validation ${enabled ? 'enabled' : 'disabled'}`);
  }

  public setMaxListenersCount(count: number): void {
    this.setMaxListeners(count);
    this.logger.debug(`Max listeners set to ${count}`);
  }

  /**
   * Emits a typed event with validation, logging, and multi-target emission.
   * Refactored to reduce cyclomatic complexity by delegating to helpers.
   */
  public emitTyped<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    payload: EventTypeToPayloadMap[TEventType]
  ): boolean {
    try {
      TypedEventBus.ensureTimestamp(payload);
      this.validateIfEnabled(eventType, payload);
      this.logIfDebug(eventType, payload);
      const specificResult = super.emit(eventType, payload);
      const namespaceResult = this.emitToNamespace(eventType, payload);
      const wildcardResult = super.emit('*', eventType, payload);
      return specificResult || namespaceResult || wildcardResult;
    } catch (error) {
      this.logger.error({ 
        event: eventType, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Error emitting event');
      if (process.env['NODE_ENV'] !== 'production') {
        throw error;
      }
      return false;
    }
  }

  public onTyped<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    listener: (_payload: EventTypeToPayloadMap[TEventType]) => void
  ): this {
    super.on(eventType, listener);
    return this;
  }

  public onNamespace<T extends BusNamespaceType>(
    namespace: T,
    listener: (_eventType: string, _payload: BusEventPayload) => void
  ): this {
    super.on(`${namespace}:*`, listener);
    return this;
  }

  public onAny(
    listener: (_eventType: string, _payload: BusEventPayload) => void
  ): this {
    super.on('*', listener);
    return this;
  }

  public onceTyped<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    listener: (_payload: EventTypeToPayloadMap[TEventType]) => void
  ): this {
    super.once(eventType, listener);
    return this;
  }

  public offTyped<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    listener: (payload: EventTypeToPayloadMap[TEventType]) => void
  ): this {
    super.off(eventType, listener);
    return this;
  }

  public clearAllListeners(): this {
    this.removeAllListeners();
    this.logger.warn('All event listeners have been removed');
    return this;
  }

  /**
   * Validates the payload if validation is enabled.
   */
  private validateIfEnabled<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    payload: EventTypeToPayloadMap[TEventType]
  ): void {
    if (this.validationEnabled) {
      validatePayload(eventType, payload);
    }
  }

  /**
   * Logs the event if debug mode is enabled.
   */
  private logIfDebug<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    payload: EventTypeToPayloadMap[TEventType]
  ): void {
    if (this.debugMode) {
      this.logger.debug({ 
        event: eventType, 
        payload: TypedEventBus.sanitizePayload(payload)
      }, 'Event emitted');
    }
  }

  /**
   * Emits the event to the namespace channel if applicable.
   */
  private emitToNamespace<TEventType extends BusEventTypeValue>(
    eventType: TEventType,
    payload: EventTypeToPayloadMap[TEventType]
  ): boolean {
    const namespace = typeof eventType === 'string' && eventType.includes(':')
      ? eventType.split(':')[0] as BusNamespaceType
      : undefined;
    if (typeof namespace === 'string') {
      return super.emit(`${namespace}:*`, eventType, payload);
    }
    return false;
  }

  // --- Private static methods must come after all public and private instance methods ---
  /**
   * Ensures the payload has a timestamp property.
   * Static because it does not use instance state.
   */
  private static ensureTimestamp(payload: BusEventPayload): void {
    if (!('timestamp' in payload)) {
      (payload as BusEventBase).timestamp = Date.now();
    }
  }

  /**
   * Sanitizes payload for logging (static helper).
   */
  private static sanitizePayload<T extends BusEventPayload>(payload: T): Record<string, unknown> {
    const result: Record<string, unknown> = { ...payload };
    if ('config' in result && result['config'] !== null && typeof result['config'] === 'object') {
      const configObj = result['config'] as Record<string, unknown>;
      if (typeof configObj['anthropic_api_key'] === 'string') {
        configObj['anthropic_api_key'] = '***REDACTED***';
      }
    }
    if (typeof result['anthropic_api_key'] === 'string') {
      result['anthropic_api_key'] = '***REDACTED***';
    }
    return result;
  }
}