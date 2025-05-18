/**
 * reporter.mjs — Formatting and output of architecture rule violations
 * 
 * Module for beautifully formatting architectural rule violation reports
 * in the CLI using colors.
 */

import chalk from 'chalk';

/**
 * Formats and outputs a violation report
 * 
 * @param {Array} violations - Array of violation objects
 * @returns {boolean} - true if there are violations
 */
export function formatReport(violations) {
  if (violations.length === 0) {
    console.log(chalk.green('✓ All architecture rules are satisfied!'));
    return false;
  }
  
  // Group violations by source file
  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.from]) acc[v.from] = [];
    acc[v.from].push(v);
    return acc;
  }, {});
  
  // Group by rule name
  const byRule = violations.reduce((acc, v) => {
    if (!acc[v.rule]) acc[v.rule] = [];
    acc[v.rule].push(v);
    return acc;
  }, {});
  
  // Output the total number of violations and the count by each rule
  console.error(chalk.red.bold(`\nFound ${violations.length} architecture rule violations:`));
  
  // Output the number of violations by rules
  for (const [rule, ruleViolations] of Object.entries(byRule)) {
    // eqeqeq: use strict comparison
    console.error(chalk.yellow(`• ${rule}: ${ruleViolations.length} violation${ruleViolations.length !== 1 ? 's' : ''}`));
  }
  
  console.error(chalk.white.bold('\nDetails:'));
  
  // Detailed output for each file
  for (const [from, entries] of Object.entries(grouped)) {
    console.error(chalk.yellow(`\n${from}`));
    for (const v of entries) {
      const lineInfo = v.line !== null ? chalk.cyan(`:${v.line}`) : '';
      const ruleName = chalk.dim(`[${v.rule}]`);
      
      // Basic output for all violations
      let details = `  ${lineInfo}  →  ${chalk.magenta(v.to)} ${ruleName}`;

      // Add message if it exists
      if (v.message !== undefined && v.message !== null) {
        details += `\n    ${chalk.italic.dim(v.message)}`;
      }

      console.error(details);
    }
  }
  
  console.error(chalk.red('\nPlease fix the architecture rule violations.'));
  
  return true;
}
