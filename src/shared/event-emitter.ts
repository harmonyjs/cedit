/**
 * Minimal event emitter interface for breaking circular dependencies
 * 
 * This file provides a simple event dispatch mechanism that can be used
 * across layers without creating circular dependencies.
 */

export interface MinimalEventEmitter {
  emit(eventType: string, ...args: unknown[]): boolean;
}

// Global event dispatcher instance
let globalEventDispatcher: MinimalEventEmitter | null = null;

/**
 * Sets the global event dispatcher
 * @param dispatcher - The event dispatcher implementation
 */
export function setEventDispatcher(dispatcher: MinimalEventEmitter): void {
  globalEventDispatcher = dispatcher;
}

/**
 * Dispatches an event using the global event dispatcher
 * @param eventType - The event type to dispatch
 * @param args - Arguments to pass to event handlers
 * @returns true if the event had listeners, false otherwise
 */
export function dispatchEvent(eventType: string, ...args: unknown[]): boolean {
  if (globalEventDispatcher) {
    return globalEventDispatcher.emit(eventType, ...args);
  }
  return false;
}
