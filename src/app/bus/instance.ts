/**
 * This file exports the singleton instance of the bus.
 * It's separated to avoid circular dependencies.
 */
import { TypedEventBus } from './typed-event-bus.js';
import { setEventDispatcher } from '#shared/event-emitter.js';

/**
 * The singleton instance of the event bus.
 * This is the central communication hub for the application.
 */
export const bus = new TypedEventBus();

// Register the bus as the global event dispatcher to receive events from other layers
// This breaks the circular dependency by using the shared event-emitter interface
setEventDispatcher({
  emit: (eventType: string, ...args: unknown[]): boolean => {
    return bus.emit(eventType, ...args);
  }
});
