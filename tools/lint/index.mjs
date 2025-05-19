#!/usr/bin/env node
/**
 * index.mjs — Core module for running ESLint programmatically
 * 
 * Provides functions to run ESLint on the project and process the results.
 * This module is used by both the issues and stats scripts.
 */

import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Get the project root directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../');

/**
 * Runs ESLint on the project and returns the results
 * 
 * @returns {Promise<Array>} The ESLint results
 */
export async function runEslint() {
  try {
    // Initialize ESLint with the fix option to match the original --fix flag
    // ESLint v9 flat config options are different from v8
    const eslint = new ESLint({ 
      fix: true,
      // ESLint v9 uses overrideConfigFile, not useEslintrc
      overrideConfigFile: resolve(PROJECT_ROOT, 'eslint.config.mjs')
    });

    // Execute linting on all files in the project
    const results = await eslint.lintFiles([PROJECT_ROOT]);
    
    // Apply fixes if available
    await ESLint.outputFixes(results);
    
    return results;
  } catch (error) {
    console.error('Error running ESLint:', error);
    throw error;
  }
}

/**
 * Extracts all messages from ESLint results
 * 
 * @param {Array} results - The ESLint results
 * @param {string|null} ruleId - Optional rule ID to filter by
 * @returns {Array} The extracted messages
 */
export function extractMessages(results, ruleId = null) {
  const messages = [];
  
  for (const result of results) {
    if (!result.messages || result.messages.length === 0) continue;
    
    const filePath = result.filePath;
    
    for (const message of result.messages) {
      // Skip messages without line numbers or if filtering by rule ID and it doesn't match
      // Magic number 0: skip messages without a line number
      if (message.line === undefined) continue;
      if (ruleId !== null && message.ruleId !== ruleId) continue;
      
      messages.push({
        filePath,
        line: message.line,
        message: message.message,
        ruleId: message.ruleId
      });
    }
  }
  
  return messages;
}

/**
 * Counts occurrences of each rule ID in the ESLint results
 * 
 * @param {Array} results - The ESLint results
 * @returns {Object} An object mapping rule IDs to their counts
 */
export function countRuleViolations(results) {
  const counts = {};
  
  for (const result of results) {
    if (!result.messages || result.messages.length === 0) continue;
    
    for (const message of result.messages) {
      if (!message.ruleId) continue;
      
      // Magic number 0: initialize rule count
      if (!counts[message.ruleId]) {
        counts[message.ruleId] = 0;
      }
      counts[message.ruleId]++;
    }
  }
  
  return counts;
}
