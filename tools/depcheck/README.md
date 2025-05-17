# cedit Architecture Rule Verification System

This directory contains a custom architecture rule verification system for the cedit project.
It extends the capabilities of [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
with additional rules and a beautiful CLI report.

## Structure

```
tools/depcheck/
  bin.mjs             # Entry point for execution (node tools/depcheck/bin.mjs)
  index.mjs           # Main code (rule loading, result aggregation)
  reporter.mjs        # Beautiful CLI violation report
  rules/
    index.mjs         # Exports all rules
    no-downward-index-imports.mjs  # Rule prohibiting downward imports
    # ... add new rules here
  utils/
    line-extractor.mjs # Extracting line numbers from dependency-cruiser output
    # ... add new utilities here
```

## Running Checks

```bash
npm run depcheck
```

## How to Add a New Rule

1. Create a file in the `rules/` directory (e.g., `new-rule.mjs`)

2. Implement the rule by exporting two objects:

```javascript
// meta - rule metadata
export const meta = {
  name: 'my-rule-name',
  description: 'Description of what the rule checks',
  severity: 'error',
};

// check - verification function
export function check(cruiserResult) {
  const violations = [];
  
  // Logic that analyzes cruiserResult
  // and adds violations to the violations array
  
  return violations;
}
```

3. Add the rule to the list in the `rules/index.mjs` file:

```javascript
import * as myRule from './new-rule.mjs';

export const rules = [
  // Existing rules...
  { 
    meta: myRule.meta, 
    check: myRule.check 
  },
];

// Add export for convenient importing
export { myRule };
```

## Violation Format

Each violation should be an object with the following fields:

```javascript
{
  rule: 'rule-name',  // Should match meta.name
  from: 'path/to/source/file', // File containing the violation
  to: 'path/to/target/file',   // If the violation is related to an import
  line: 42, // Line number (if available)
}
```

## Unit Tests

Tests for architecture rules can be added to the `tests/` directory. It's recommended to create separate tests for each rule or group of related rules.
