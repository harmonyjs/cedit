/**
 * Shared event bus types for infra/app boundary
 *
 * This file exists to break circular dependencies between infra/logging and app/bus.
 * Only types/interfaces/constants that are needed by both layers should be placed here.
 */

// Event bus log level
export type EventBusLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Infrastructure log event payload
export interface EventBusLogPayload {
  timestamp: number;
  message: string;
  level: EventBusLogLevel;
  scope: string;
  data?: Record<string, unknown>;
}

// Event type for infra log events
export const BUS_EVENT_TYPE_INFRA_LOG = 'infra:log' as const;
