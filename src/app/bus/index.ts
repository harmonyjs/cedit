/**
 * Event Bus Module
 *
 * This module provides a central event bus for the application.
 * It re-exports the bus instance, types, and emitter functions.
 */

// Export the bus instance
export { bus } from './instance.js';

// Forward exports from types.ts (except EventBusLogPayload/Level, now in shared)
export * from './types.js';

// Forward exports from emitters.ts
export * from './emitters.js';