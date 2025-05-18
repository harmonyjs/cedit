import { EventEmitter } from 'node:events';
import type { CliConfig } from '../model/index.js'; // Removed DomainEvent import
import { getLogger } from '../../infra/logging/index.js';
import {
  type BusNamespaceType,
  type BusEventTypeValue,
  type BusEventBase,
  type BusEventPayload,
  type EventTypeToPayloadMap
} from './types.js';
import { validatePayload } from './payload-validator.js';

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
    model: 'claude-3-sonnet-20240229',
    retries: 3,
    sleep_between_requests_ms: 1000,
  },
  dry_run: false,
  max_tokens: 200000,
  varsOverride: {},
};

export class TypedEventBus extends EventEmitter {
  private logger = getLogger('bus', DEFAULT_LOG_CONFIG);
  private debugMode = false;
  private validationEnabled = true;

  private sanitizePayload<T extends BusEventPayload>(payload: T): Record<string, unknown> {
    const result: Record<string, unknown> = { ...payload };
    if ('config' in result && result.config && typeof result.config === 'object') {
      const configObj = result.config as Record<string, unknown>;
      if ('anthropic_api_key' in configObj) {
        configObj.anthropic_api_key = '***REDACTED***';
      }
    }
    if ('anthropic_api_key' in result && typeof result.anthropic_api_key === 'string') {
      result.anthropic_api_key = '***REDACTED***';
    }
    return result;
  }

  constructor() {
    super();
    this.setMaxListeners(50);
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

  public emitTyped<T_EVENT extends BusEventTypeValue>(
    eventType: T_EVENT,
    payload: EventTypeToPayloadMap[T_EVENT]
  ): boolean {
    try {
      if (!('timestamp' in payload)) {
        (payload as BusEventBase).timestamp = Date.now();
      }
      if (this.validationEnabled) {
        validatePayload(eventType, payload); // Use imported validator
      }
      if (this.debugMode) {
        this.logger.debug({ 
          event: eventType, 
          payload: this.sanitizePayload(payload)
        }, 'Event emitted');
      }
      const specificResult = super.emit(eventType, payload);
      const namespace = eventType.split(':')[0] as BusNamespaceType;
      const namespaceResult = super.emit(`${namespace}:*`, eventType, payload);
      const wildcardResult = super.emit('*', eventType, payload);
      return specificResult || namespaceResult || wildcardResult;
    } catch (error) {
      this.logger.error({ 
        event: eventType, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Error emitting event');
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
      return false;
    }
  }

  public onTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (_payload: EventTypeToPayloadMap[T]) => void
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

  public onceTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (_payload: EventTypeToPayloadMap[T]) => void
  ): this {
    super.once(eventType, listener);
    return this;
  }

  public offTyped<T extends BusEventTypeValue>(
    eventType: T,
    listener: (payload: EventTypeToPayloadMap[T]) => void
  ): this {
    super.off(eventType, listener);
    return this;
  }

  public clearAllListeners(): this {
    this.removeAllListeners();
    this.logger.warn('All event listeners have been removed');
    return this;
  }
}
