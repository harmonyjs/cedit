#!/usr/bin/env node
/**
 * bin-stats.mjs — CLI tool for displaying ESLint rule violation statistics
 * 
 * ──────────────────────────────────────────────────────────────
 *
 * Purpose:
 *   This script runs ESLint on the project and displays statistics about
 *   rule violations, sorted by count in descending order.
 *
 * Usage:
 *   node tools/lint/bin-stats.mjs
 *
 * Output Format:
 *       7 @typescript-eslint/no-unused-vars
 *       3 max-lines-per-function
 *       2 @typescript-eslint/no-explicit-any
 *
 * Exit Codes:
 *   0 - No issues found or successful execution
 *   1 - Issues found or error during execution
 *
 * (c) cedit, 2025
 */

import { runEslint, countRuleViolations } from './index.mjs';
import { formatStats } from './reporter.mjs';

// Magic numbers 1 and 0: Standard POSIX exit codes for error/success
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;
// Main function
async function main() {
  try {
    // Run ESLint
    const results = await runEslint();
    // Count and format rule violations
    const counts = countRuleViolations(results);
    const hasIssues = formatStats(counts);
    // Exit with appropriate code
    process.exit(hasIssues ? EXIT_CODE_FAILURE : EXIT_CODE_SUCCESS);
  } catch (error) {
    console.error('Error:', error);
    process.exit(EXIT_CODE_FAILURE);
  }
}

// Run the script
main();
