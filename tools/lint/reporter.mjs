/**
 * reporter.mjs — Formatting and output of ESLint issues
 * 
 * Module for formatting ESLint issues in a readable format with
 * numbering and highlighting. Provides similar output format to
 * the original bash script.
 */

import chalk from 'chalk';

/**
 * Formats and outputs the lint issues in a readable format
 * 
 * @param {Array} messages - The ESLint messages to format
 * @param {string|null} ruleId - The rule ID being filtered by, if any
 * @returns {boolean} true if issues were found, false otherwise
 */
export function formatIssues(messages, ruleId = null) {
  // Magic number 0: zero issues means success
  if (messages.length === 0) {
    if (ruleId) {
      console.log(`No lint issues found for rule '${ruleId}'.`);
    } else {
      console.log('No lint issues found.');
    }
    return false;
  }
  
  // Format each message with numbering
  let count = 0;
  for (const msg of messages) {
    count++;
    console.log(chalk(`${count.toString().padStart(2, ' ')}. | ${msg.filePath}:${msg.line}`));
    console.log(`    | ${chalk.blue('→')} ${msg.message}`);
    console.log(''); // Empty line after each issue
  }
  
  console.log(`Total issues: ${messages.length}`);
  return true;
}

/**
 * Formats and outputs the rule violation statistics
 * 
 * @param {Object} counts - An object mapping rule IDs to their counts
 * @returns {boolean} true if violations were found, false otherwise
 */
export function formatStats(counts) {
  const entries = Object.entries(counts);
  
  // Magic number 0: zero entries means no issues
  if (entries.length === 0) {
    console.log('No lint issues found.');
    return false;
  }
  
  // Sort entries by count in descending order
  entries.sort((a, b) => b[1] - a[1]);
  
  // Format and print each entry
  for (const [ruleId, count] of entries) {
    const countStr = count.toString().padStart(7, ' ');
    console.log(`${chalk.yellow(countStr)} ${ruleId}`);
  }
  
  return true;
}
