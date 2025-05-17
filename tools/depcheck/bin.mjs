#!/usr/bin/env node
/**
 * bin.mjs — Entry point for running architecture rule checks
 * 
 * ──────────────────────────────────────────────────────────────
 *
 * Purpose:
 *   This script launches the architecture rule verification system for cedit.
 *   It analyzes the import structure in the project and verifies compliance
 *   with architectural principles, using both built-in dependency-cruiser rules
 *   and custom rules implemented in the rules/ directory.
 *
 * How it works:
 *   1. Runs dependency-cruiser to get a JSON report on dependencies.
 *   2. Applies all custom rules from the rules/ directory.
 *   3. Formats results in a beautiful CLI report with grouping by files.
 *   4. Returns error code 1 if violations are found.
 *
 * Custom rules:
 *   - no-downward-index-imports: prohibits importing index.ts/js from child directories.
 *
 * Extending the system:
 *   To add a new rule:
 *   1. Create a file in the rules/ directory (e.g., new-rule.mjs)
 *   2. Export a meta object and check() function from the file
 *   3. Add the new rule to the rules array in the rules/index.mjs file
 *
 * (c) cedit, 2025
 */

import { runChecks } from './index.mjs';

// Run checks
runChecks().then((hasViolations) => {
  process.exit(hasViolations ? 1 : 0);
}).catch((err) => {
  console.error('Critical error during checks:', err);
  process.exit(1);
});
