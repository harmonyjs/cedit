# Event Bus Module Documentation

This document provides examples and guidelines for using the Event Bus module in the cedit CLI tool.

## Overview

The Event Bus is a central communication hub that allows different parts of the application to communicate without direct dependencies, following a publish-subscribe pattern. It's implemented using Node.js's built-in `EventEmitter` with additional type safety, validation, and organization features.

## Key Features

- **Type-safe event emission and subscription**
- **Event namespacing** for better organization
- **Payload validation**
- **Error handling**
- **Debug mode** for logging all events
- **Integration with the logging system**
- **Wildcard subscriptions** for namespace and global events

## Event Structure

Events are organized into three main namespaces:

1. **init** - Events related to application initialization
2. **domain** - Events related to domain operations (file editing, viewing, etc.)
3. **finish** - Events related to application completion

Each event has a specific type and a typed payload.

## Usage Examples

### Basic Usage

```typescript
import { bus, BusEventType, emitInitConfig } from '../app/bus/index.js';
import type { CliConfig } from '../app/model/index.js';

// Subscribe to an event
bus.onTyped(BusEventType.INIT_CONFIG, (payload) => {
  console.log('Received config:', payload.config);
});

// Emit an event using helper function
const config: CliConfig = { /* ... */ };
emitInitConfig(config);

// Or emit directly
bus.emitTyped(BusEventType.INIT_CONFIG, { 
  timestamp: Date.now(), 
  config 
});
```

### Subscribing to Events

```typescript
import { bus, BusEventType, BusNamespace } from '../app/bus/index.js';

// Subscribe to a specific event
bus.onTyped(BusEventType.DOMAIN_FILE_EDITED, (payload) => {
  console.log('File edited:', payload.event.path);
});

// Subscribe to all events in a namespace
bus.onNamespace(BusNamespace.DOMAIN, (eventType, payload) => {
  console.log(`Domain event ${eventType}:`, payload);
});

// Subscribe to all events (global wildcard)
bus.onAny((eventType, payload) => {
  console.log(`Event ${eventType}:`, payload);
});

// One-time subscription
bus.onceTyped(BusEventType.FINISH_SUMMARY, (payload) => {
  console.log('Final summary:', payload.stats);
});
```

### Emitting Domain Events

```typescript
import { emitDomainEvent } from '../app/bus/index.js';
import type { FileEdited } from '../app/model/index.js';

// Create a domain event
const fileEditedEvent: FileEdited = {
  type: 'FileEdited',
  path: '/path/to/file.txt',
  lines: 10,
  stats: {
    added: 5,
    removed: 2,
    changed: 3
  }
};

// Emit the domain event
emitDomainEvent(fileEditedEvent);
```

### Emitting Finish Events

```typescript
import { emitFinishSummary, emitFinishAbort } from '../app/bus/index.js';

// Emit a successful completion
emitFinishSummary({
  filesEdited: 3,
  filesCreated: 1,
  backupsCreated: 4,
  totalEdits: {
    added: 15,
    removed: 7,
    changed: 5
  }
}, 2500); // duration in ms

// Emit an abort
emitFinishAbort('Token limit exceeded', 'TOKEN_LIMIT');
```

### Unsubscribing from Events

```typescript
import { bus, BusEventType } from '../app/bus/index.js';

const handleConfig = (payload) => {
  console.log('Config received:', payload.config);
};

// Subscribe
bus.onTyped(BusEventType.INIT_CONFIG, handleConfig);

// Later, unsubscribe
bus.offTyped(BusEventType.INIT_CONFIG, handleConfig);
```

### Configuration

```typescript
import { bus } from '../app/bus/index.js';

// Enable debug mode to log all events
bus.setDebugMode(true);

// Disable validation for performance in production
bus.setValidation(false);

// Set maximum number of listeners
bus.setMaxListenersCount(100);

// Clear all listeners (useful for testing)
bus.clearAllListeners();
```

## Integration Examples

### Integration with UI Layer

```typescript
// In ui/tui/index.ts
import { bus, BusEventType, BusNamespace } from '../../app/bus/index.js';
import { log } from '@clack/prompts';

// Subscribe to domain events to update the UI
bus.onNamespace(BusNamespace.DOMAIN, (eventType, payload) => {
  if (eventType === BusEventType.DOMAIN_FILE_EDITED) {
    const event = payload.event;
    log.success(`Edited ${event.path} (${event.lines} lines)`);
  } else if (eventType === BusEventType.DOMAIN_ERROR) {
    const event = payload.event;
    log.error(`Error: ${event.message}`);
  }
});

// Subscribe to finish events to show summary
bus.onTyped(BusEventType.FINISH_SUMMARY, (payload) => {
  const { stats } = payload;
  log.success(`Done! +${stats.totalEdits.added} ⬆ −${stats.totalEdits.removed} ⬇ ~${stats.totalEdits.changed} ✱`);
});
```

### Integration with Runner

```typescript
// In app/runner/index.ts
import { bus, BusEventType, emitInitConfig, emitFinishSummary, emitDomainEvent } from '../bus/index.js';
import type { CliConfig, DomainEvent } from '../model/index.js';

export async function run(config: CliConfig): Promise<void> {
  // Emit initialization event
  emitInitConfig(config);
  
  const startTime = Date.now();
  const events: DomainEvent[] = [];
  
  try {
    // Run the application logic
    // ...
    
    // Collect domain events
    events.forEach(event => {
      emitDomainEvent(event);
    });
    
    // Emit finish event with summary
    const duration = Date.now() - startTime;
    emitFinishSummary({
      filesEdited: events.filter(e => e.type === 'FileEdited').length,
      filesCreated: events.filter(e => e.type === 'FileCreated').length,
      backupsCreated: events.filter(e => e.type === 'BackupCreated').length,
      totalEdits: calculateTotalEdits(events)
    }, duration);
  } catch (error) {
    // Emit abort event on error
    emitFinishAbort(error.message, error.code);
  }
}
```

## Best Practices

1. **Use helper functions** when possible instead of direct `emitTyped` calls
2. **Subscribe early** in the application lifecycle to avoid missing events
3. **Unsubscribe** when components are destroyed to avoid memory leaks
4. **Use namespaces** to organize event subscriptions
5. **Enable debug mode** during development to see all events
6. **Validate payloads** to catch errors early
7. **Use type safety** to ensure correct event payloads

## Common Pitfalls

1. **Circular dependencies** - The bus should be imported by other modules, not the other way around
2. **Memory leaks** - Always unsubscribe when components are destroyed
3. **Event storms** - Avoid emitting too many events in rapid succession
4. **Missing events** - Subscribe before events are emitted
5. **Type errors** - Use the provided type-safe methods to avoid runtime errors