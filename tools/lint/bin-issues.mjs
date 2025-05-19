#!/usr/bin/env node
/**
 * bin-issues.mjs — CLI tool for displaying ESLint issues in the project
 * 
 * ──────────────────────────────────────────────────────────────
 *
 * Purpose:
 *   This script runs ESLint on the project and displays any issues found
 *   in a readable format with numbering and colorized output. It can also
 *   filter issues by rule ID.
 *
 * Usage:
 *   node tools/lint/bin-issues.mjs           # Show all issues
 *   node tools/lint/bin-issues.mjs -t ruleId # Filter by rule ID
 *
 * Example:
 *   node tools/lint/bin-issues.mjs -t @typescript-eslint/naming-convention
 *
 * Output Format:
 *   #  1. | /path/to/file.ts:10
 *   #     |  → Some lint message
 *   
 *   Total issues: X
 *
 * Exit Codes:
 *   0 - No issues found or successful execution
 *   1 - Issues found or error during execution
 *
 * (c) cedit, 2025
 */

import { runEslint, extractMessages } from './index.mjs';
import { formatIssues } from './reporter.mjs';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let ruleId = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' && i + 1 < args.length) {
      ruleId = args[i + 1];
      break;
    }
  }
  
  return { ruleId };
}

// Magic numbers 1 and 0: Standard POSIX exit codes for error/success
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;
// Main function
async function main() {
  try {
    const { ruleId } = parseArgs();
    // Run ESLint
    const results = await runEslint();
    // Extract and format messages
    const messages = extractMessages(results, ruleId);
    const hasIssues = formatIssues(messages, ruleId);
    // Exit with appropriate code
    process.exit(hasIssues ? EXIT_CODE_FAILURE : EXIT_CODE_SUCCESS);
  } catch (error) {
    console.error('Error:', error);
    process.exit(EXIT_CODE_FAILURE);
  }
}

// Run the script
main();
