# How to Add CLI Arguments - Developer Guide

## 🎯 Overview

This guide explains how to safely add new CLI arguments to the cedit application using our centralized, type-safe CLI system. Our system provides **compile-time guarantees** that prevent CLI argument mismatches and ensures consistency across the entire codebase.

## 🛡️ Why This System Exists

**Problem Solved**: Previously, adding CLI arguments required manual synchronization across multiple files, leading to bugs like:
- Commander.js option key (`config`) ≠ Parser usage (`configPath`)
- Runtime failures that were hard to debug
- No compile-time protection against typos

**Solution**: Centralized registry with TypeScript compile-time safety that makes **inconsistent CLI arguments impossible**.

## 📋 Step-by-Step Guide: Adding a New CLI Argument

### Step 1: Add to Central Registry

**File**: `src/ui/cli/definitions/registry.ts`

Add your new option to `CLI_OPTION_DEFINITIONS`:

```typescript
export const CLI_OPTION_DEFINITIONS = {
  // ...existing options...
  
  // 🆕 Add your new option here
  timeout: {
    type: 'option' as const,
    commanderFlag: '--timeout <seconds>',          // What users type
    commanderKey: 'timeout' as const,              // What Commander.js provides
    internalKey: 'timeoutSeconds' as const,        // What we use internally
    description: 'Timeout in seconds for operations',
    required: false,
    parser: parseInt as (value: string) => number, // Optional: for number conversion
  },
  
  // Example: Boolean flag
  verbose: {
    type: 'option' as const,
    commanderFlag: '--verbose',
    commanderKey: 'verbose' as const,
    internalKey: 'verbose' as const,
    description: 'Enable verbose output',
    required: false,
  },
  
  // Example: Array option with default
  include: {
    type: 'option' as const,
    commanderFlag: '--include <patterns...>',
    commanderKey: 'include' as const,
    internalKey: 'includePatterns' as const,
    description: 'Include patterns for file matching',
    required: false,
    defaultValue: [] as string[],
  },
} as const;
```

### Step 2: Update Type Interfaces

**File**: `src/ui/cli/types.ts`

Add your option to both interfaces:

```typescript
/**
 * Interface for values provided by Commander.js.
 */
export interface CommanderOptionValues {
  // ...existing options...
  timeout?: number;           // Matches registry.commanderKey
  verbose?: boolean;
  include?: string[];
}

/**
 * Interface for CLI flags used internally throughout the application.
 */
export interface CliFlags {
  // ...existing options...
  timeoutSeconds: number;     // Matches registry.internalKey
  verbose: boolean | undefined;
  includePatterns: string[];
}
```

### Step 3: Update Parser Logic

**File**: `src/ui/cli/execution/parser.ts`

Add mapping in the `flags` object construction:

```typescript
// Type-safe option mapping using centralized registry
const flags: CliFlags = {
  // ...existing mappings...
  timeoutSeconds: getNumberOpt(opts.timeout),
  verbose: getBooleanOpt(opts.verbose),
  includePatterns: opts.include || [],
};
```

### Step 4: Use in Your Code

Now you can safely use the new option anywhere in the codebase:

```typescript
import type { CliFlags } from '#src/ui/cli/types.js';

function someFunction(flags: CliFlags) {
  // ✅ Type-safe access to your new options
  if (flags.timeoutSeconds > 0) {
    console.log(`Using timeout: ${flags.timeoutSeconds} seconds`);
  }
  
  if (flags.verbose) {
    console.log('Verbose mode enabled');
  }
  
  for (const pattern of flags.includePatterns) {
    console.log(`Including pattern: ${pattern}`);
  }
}
```

## 🔧 Compile-Time Guarantees Explained

Our system provides **multiple layers of compile-time safety**:

### 1. **Registry Consistency**

```typescript
// ❌ This will cause a TypeScript error:
export const CLI_OPTION_DEFINITIONS = {
  timeout: {
    commanderKey: 'timeout' as const,
    internalKey: 'timeoutSeconds' as const,
    // Missing required properties - TypeScript error!
  }
} as const;
```

### 2. **Type Interface Synchronization**

```typescript
// ❌ This will cause a TypeScript error:
export interface CommanderOptionValues {
  wrongName?: number;  // Doesn't match registry.commanderKey
}

// ❌ This will also cause an error:
export interface CliFlags {
  timeout: number;     // Should be 'timeoutSeconds' per registry.internalKey
}
```

### 3. **Parser Mapping Safety**

```typescript
// ❌ This will cause a TypeScript error:
const flags: CliFlags = {
  timeout: getNumberOpt(opts.timeout),  // Error: 'timeout' doesn't exist on CliFlags
  wrongKey: opts.nonexistent,           // Error: 'wrongKey' doesn't exist
};
```

### 4. **Usage Safety**

```typescript
function myFunction(flags: CliFlags) {
  // ❌ This will cause a TypeScript error:
  const value = flags.typo;           // Property 'typo' doesn't exist
  const wrong = flags.timeout;        // Should be 'timeoutSeconds'
}
```

## 🧪 Testing Your New Argument

### 1. Compile-Time Validation

```bash
npm run typecheck
```
This **must pass** - if it doesn't, you have inconsistencies that need fixing.

### 2. Runtime Testing

```bash
# Test your new option
npm run dev -- specs/test.yml --timeout 30 --verbose

# Test help output (should show your new option)
npm run dev -- --help

# Test unknown options are rejected
npm run dev -- specs/test.yml --fake-option value
# Should show: "error: unknown option '--fake-option'"
```

### 3. Full Validation

```bash
npm run lint && npm run typecheck && npm run test
```

## 📚 Advanced Examples

### Complex Option with Validation

```typescript
// In registry.ts
apiKey: {
  type: 'option' as const,
  commanderFlag: '--api-key <key>',
  commanderKey: 'apiKey' as const,
  internalKey: 'apiKey' as const,
  description: 'API key for authentication',
  required: true,  // This option is required
},

// In parser.ts - add custom validation
if (flags.apiKey && flags.apiKey.length < 10) {
  throw new Error('API key must be at least 10 characters');
}
```

### Dependent Options

```typescript
// In your application logic
function validateFlags(flags: CliFlags): void {
  if (flags.verbose && !flags.logLevel) {
    console.warn('Verbose mode works best with --log-level debug');
  }
  
  if (flags.dryRun && flags.yes) {
    throw new Error('Cannot use --dry-run with --yes (no confirmation needed for dry run)');
  }
}
```

## ⚠️ Common Mistakes and How to Avoid Them

### 1. **Name Mismatches**

```typescript
// ❌ Wrong - mismatched names
{
  commanderKey: 'maxTokens' as const,
  internalKey: 'maxTokenNumber' as const,  // Different from commanderKey
}

// ✅ Correct - either same name or intentionally different
{
  commanderKey: 'maxTokens' as const,
  internalKey: 'maxTokens' as const,       // Same name
}
// OR
{
  commanderKey: 'config' as const,
  internalKey: 'configPath' as const,      // Intentionally different, clear mapping
}
```

### 2. **Forgetting Required Properties**

```typescript
// ❌ Wrong - missing required 'type'
newOption: {
  commanderFlag: '--new-option',
  // Missing 'type', 'commanderKey', 'internalKey', etc.
}

// ✅ Correct - all required properties
newOption: {
  type: 'option' as const,
  commanderFlag: '--new-option',
  commanderKey: 'newOption' as const,
  internalKey: 'newOption' as const,
  description: 'Description of the new option',
  required: false,
}
```

### 3. **Incorrect Parser Functions**

```typescript
// ❌ Wrong - invalid parser
{
  parser: 'parseInt',  // String instead of function
}

// ✅ Correct - proper function reference with typing
{
  parser: parseInt as (value: string) => number,
}
```

## 🔍 Debugging Guide

### Problem: "Property 'myNewOption' does not exist on type 'CommanderOptionValues'"

**Solution**: You added the option to the registry but forgot to update the interface:

```typescript
// Add to CommanderOptionValues in types.ts
export interface CommanderOptionValues {
  myNewOption?: string;  // Add this line
}
```

### Problem: "Property 'myInternalKey' does not exist on type 'CliFlags'"

**Solution**: You forgot to update the internal interface:

```typescript
// Add to CliFlags in types.ts
export interface CliFlags {
  myInternalKey?: string;  // Add this line
}
```

### Problem: Option not showing in help output

**Solution**: The registry auto-generates help, but check:

1. Your option is properly defined in the registry
2. The `commanderFlag` format is correct
3. You're not overriding help somewhere else

```bash
# Test help output
npm run dev -- --help
```

### Problem: "unknown option" error when option should be valid

**Solution**: Check the `commanderFlag` format:

```typescript
// ❌ Wrong format
commanderFlag: 'timeout <seconds>',     // Missing dashes

// ✅ Correct format
commanderFlag: '--timeout <seconds>',   // Has proper dashes
```

### Problem: TypeScript errors after adding new option

**Common causes and fixes:**

1. **Registry definition incomplete**:
   ```typescript
   // Make sure all required fields are present
   myOption: {
     type: 'option' as const,           // Required
     commanderFlag: '--my-option',      // Required
     commanderKey: 'myOption' as const, // Required
     internalKey: 'myOption' as const,  // Required
     description: 'My option',          // Required
     required: false,                   // Required
   },
   ```

2. **Interface mismatch**:
   ```typescript
   // CommanderOptionValues must match commanderKey
   // CliFlags must match internalKey
   ```

3. **Parser not updated**:
   ```typescript
   // Add mapping in parser.ts
   const flags: CliFlags = {
     myOption: opts.myOption,  // Add this line
   };
   ```

## 🎯 Best Practices

### 1. **Consistent Naming Convention**

```typescript
// Use kebab-case for CLI flags
commanderFlag: '--max-tokens <number>',

// Use camelCase for internal keys  
internalKey: 'maxTokens' as const,

// Match Commander.js conventions
commanderKey: 'maxTokens' as const,
```

### 2. **Clear, Descriptive Flags**

```typescript
// ❌ Unclear
commanderFlag: '--mt <n>',
description: 'Max tokens',

// ✅ Clear and descriptive
commanderFlag: '--max-tokens <number>',
description: 'Maximum number of tokens to process per request',
```

### 3. **Sensible Defaults**

```typescript
// In parser.ts, provide sensible defaults
maxTokens: opts.maxTokens ?? 1000,

// Or in registry with defaultValue
defaultValue: 1000,
```

### 4. **Group Related Options**

```typescript
// Group logically related options together in registry
export const CLI_OPTION_DEFINITIONS = {
  // Configuration options
  config: { /* ... */ },
  configEnv: { /* ... */ },
  
  // API options  
  apiKey: { /* ... */ },
  apiUrl: { /* ... */ },
  maxTokens: { /* ... */ },
  
  // Output options
  output: { /* ... */ },
  format: { /* ... */ },
  verbose: { /* ... */ },
} as const;
```

## 📖 Real-World Example: Adding a `--format` Option

Let's walk through adding a format option step by step:

### Step 1: Registry Definition

```typescript
// src/ui/cli/definitions/registry.ts
format: {
  type: 'option' as const,
  commanderFlag: '--format <type>',
  commanderKey: 'format' as const,
  internalKey: 'outputFormat' as const,
  description: 'Output format: json, yaml, or text (default: text)',
  required: false,
},
```

### Step 2: Update Types

```typescript
// src/ui/cli/types.ts

// Add to CommanderOptionValues
export interface CommanderOptionValues {
  format?: string;  // Matches commanderKey
}

// Add to CliFlags  
export interface CliFlags {
  outputFormat?: 'json' | 'yaml' | 'text';  // Matches internalKey with specific types
}
```

### Step 3: Update Parser

```typescript
// src/ui/cli/execution/parser.ts

const flags: CliFlags = {
  // Add validation and default
  outputFormat: validateFormat(opts.format) ?? 'text',
};

function validateFormat(format?: string): 'json' | 'yaml' | 'text' | undefined {
  if (!format) return undefined;
  
  if (['json', 'yaml', 'text'].includes(format)) {
    return format as 'json' | 'yaml' | 'text';
  }
  
  throw new Error(`Invalid format: ${format}. Must be json, yaml, or text.`);
}
```

### Step 4: Use in Code

```typescript
// Anywhere in your application
function generateOutput(data: any, flags: CliFlags): string {
  switch (flags.outputFormat) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return yaml.dump(data);
    case 'text':
    default:
      return formatAsText(data);
  }
}
```

### Step 5: Test

```bash
# Test the new option
npm run dev -- input.txt --format json
npm run dev -- input.txt --format yaml  
npm run dev -- input.txt --format text

# Test validation
npm run dev -- input.txt --format invalid  # Should error

# Test help
npm run dev -- --help  # Should show --format option
```

## 🚀 Advanced Features

### Environment Variable Fallbacks

```typescript
// In parser.ts
outputFormat: opts.format || process.env.CEDIT_FORMAT || 'text',
```

### Option Dependencies

```typescript
// In your validation logic
if (flags.watch && flags.outputFormat !== 'text') {
  console.warn('Watch mode works best with text format for real-time updates');
}
```

### Conditional Options

```typescript
// Make some options available only in certain contexts
if (process.env.NODE_ENV === 'development') {
  // Add debug-only options
}
```

This centralized system ensures that **every CLI argument change is type-safe, consistent, and automatically validated**. Once you follow these patterns, it becomes impossible to have CLI argument mismatches!

## 🎉 Benefits You Get

### For You as a Developer
- ✅ **Impossible to create CLI argument bugs** - TypeScript prevents them
- ✅ **Clear guidance** - Compilation errors show exactly what to fix
- ✅ **Consistent patterns** - Same approach for all CLI arguments
- ✅ **Automatic synchronization** - Change registry, everything else follows

### For the Codebase
- ✅ **Single source of truth** - All CLI options defined in one place
- ✅ **Self-documenting** - Registry serves as comprehensive CLI documentation
- ✅ **Easy refactoring** - Change an option name, compiler shows all affected code
- ✅ **Runtime safety** - Additional validation catches edge cases

### For Users
- ✅ **Reliable CLI** - No broken options due to internal inconsistencies
- ✅ **Clear help output** - Automatically generated from registry
- ✅ **Consistent behavior** - All options handled uniformly

## 🔍 Debugging Guide

### Compilation Error: "Property doesn't exist"

```
Error: Property 'myOption' does not exist on type 'CliFlags'
```

**Solution**: Add `myOption` to the `CliFlags` interface in `types.ts`

### Compilation Error: "Type is not assignable"

```
Error: Type 'string | undefined' is not assignable to type 'string'
```

**Solution**: Check if your option should be optional (`string | undefined`) or required (`string`)

### Runtime Error: "Unknown option"

```
error: unknown option '--my-option'
```

**Solution**: 
1. Check that option is in `CLI_OPTION_DEFINITIONS`
2. Verify `commanderFlag` format is correct
3. Run `npm run typecheck` to catch other issues

## 📖 Summary

Adding CLI arguments with our system is **safer and easier** than traditional approaches:

1. **Add to registry** → TypeScript guides the rest
2. **Update interfaces** → Compiler ensures consistency  
3. **Update parser** → Type safety prevents errors
4. **Use anywhere** → Full type safety throughout codebase

The compile-time guarantees mean that **if your code compiles, your CLI arguments will work correctly**. No more runtime surprises, no more name mismatches, no more forgotten updates.

**Result**: Robust, maintainable CLI that scales safely with your application! 🚀
