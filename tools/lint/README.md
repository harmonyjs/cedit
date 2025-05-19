# ESLint Tools

This directory contains Node.js tools for running ESLint and displaying results in a friendly format.

## Tools

- **bin-issues.mjs**: Displays all lint issues in a readable format, with numbering and total count.
  ```
  # Usage:
  node tools/lint/bin-issues.mjs           # Show all issues
  node tools/lint/bin-issues.mjs -t ruleId # Filter by rule ID
  ```

- **bin-stats.mjs**: Displays statistics about rule violations, sorted by count in descending order.
  ```
  # Usage:
  node tools/lint/bin-stats.mjs
  ```

## Implementation

These tools use the ESLint JavaScript API to run linting programmatically, rather than calling the CLI command.
This approach provides better performance and integration.

## Extending

If you need to add new functionality to these tools:

1. Add common code to `index.mjs`
2. Add formatting functions to `reporter.mjs`
3. Create a new command file (e.g., `bin-new-command.mjs`)
4. Update the package.json scripts as needed
