
# Logging Infrastructure (Internal Helpers)

The following describes the internal helper functions used in `transport.ts` for the cedit logging infrastructure. These are referenced from the code but have their detailed documentation here to keep the source file under the 200-line limit.

---

## `createLogFileStream(logDir?: string): fs.WriteStream | null`
Creates a writable file stream for log output. If no directory is provided, returns null. Ensures the directory exists and creates a log file named with the current date.

## `mapPinoLevelToEventBusLevel(pinoLevel: number): EventBusLogLevel`
Maps a numeric Pino log level to the corresponding event bus log level string.

## `processLogEvent(logData: Record<string, unknown>): EventBusLogPayload`
Converts a parsed Pino log object into a payload for the event bus, mapping levels and extracting message, scope, and additional data.

## `parseLogChunk(chunk: unknown): Record<string, unknown> | null`
Safely parses a log chunk (string or buffer) as JSON, returning a plain object or null if parsing fails.

## `emitToEventBus(payload: EventBusLogPayload): void`
Emits a log payload to the event bus if the bus and its `emitTyped` method are available.

---

See the source for implementation details. All other helpers are imported from `logging-helpers.ts`.
