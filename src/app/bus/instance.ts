/**
 * This file exports the singleton instance of the bus.
 * It's separated to avoid circular dependencies.
 */
import { TypedEventBus } from './typed-event-bus.js';

/**
 * The singleton instance of the event bus.
 * This is the central communication hub for the application.
 */
export const bus = new TypedEventBus();
