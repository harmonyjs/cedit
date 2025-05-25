# Terminal Output Guidelines

## Overview

This project enforces centralized terminal output through the logging system integrated with the TUI (Terminal User Interface). All output must go through `getLogger()` rather than direct console or process stream usage.

## Key Principles

### ✅ DO Use Logger Methods
```typescript
import { getLogger } from '#infra/logging';

const logger = getLogger('module-name');

// Use appropriate log levels
logger.info('User-facing information');
logger.warn('Important warnings');
logger.error('Error conditions');
logger.debug('Development/troubleshooting info');
```

### ❌ DON'T Use Direct Console/Process Output
```typescript
// ❌ PROHIBITED - Will cause ESLint errors
console.log('message');
console.error('error');
console.warn('warning');
console.info('info');
console.debug('debug');
process.stdout.write('data');
process.stderr.write('error');
```

## Integration with TUI

The logging system is automatically integrated with the TUI interface:

- **Logger calls** → **Bus events** → **TUI display**
- No duplicate output in TTY environments
- Proper formatting and progress display
- Centralized log file output

## Exception Scenarios

### Critical Application Errors
For application-level failures where the logger may not be available:
```typescript
// ESLint disable required with justification
// eslint-disable-next-line no-restricted-properties -- Critical app startup error, logger not available
console.error('Failed to initialize application:', error);
```

### Non-TTY Environments
For environments where TUI is unavailable:
```typescript
if (!process.stdout.isTTY) {
  // eslint-disable-next-line no-restricted-properties -- Non-TTY environment fallback
  console.log(message);
}
```

## ESLint Configuration

The project enforces these rules through ESLint:

```javascript
'no-restricted-properties': [
  'error',
  {
    object: 'console',
    message: 'Use getLogger() instead of console for centralized output through TUI'
  },
  {
    object: 'process',
    property: 'stdout',
    message: 'Use getLogger() instead of process.stdout for centralized output through TUI'
  }
  // ... additional restrictions
]
```

## Testing

Console usage is permitted in test files (`tests/**`) and development tools (`tools/**`) where direct output is appropriate.

## Development Workflow

1. **Always use `getLogger()`** for any output needs
2. **Choose appropriate log levels** based on content importance
3. **Test with TUI** to ensure proper display integration
4. **Only add ESLint disables** for documented exception scenarios
5. **Include justification comments** for any disable directives

## Benefits

- **Consistent formatting** across all output
- **Integrated progress display** with TUI
- **Centralized log management** 
- **No duplicate output** in terminal interfaces
- **Better user experience** with unified interface
- **Easier debugging** through structured logging

## Migration Notes

When converting existing `console.*` usage:

- `console.log()` → `logger.info()`
- `console.error()` → `logger.error()`
- `console.warn()` → `logger.warn()`
- `console.debug()` → `logger.debug()`
- Remove any manual progress indicators (TUI handles this)
- Test output in both TTY and non-TTY environments
