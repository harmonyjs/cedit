/**
 * index.mjs — Exports all rules for architecture verification
 * 
 * This file collects all rules from the rules/ directory and exports
 * them as a single array for use in the main depcheck module.
 */

import * as noDownwardIndexImports from './no-downward-index-imports.mjs';

// Export an array of rules with their metadata and check functions
export const rules = [
  { 
    meta: noDownwardIndexImports.meta, 
    check: noDownwardIndexImports.check 
  },
  // Add new rules here
];

// Export for convenient import using destructuring
export { noDownwardIndexImports };
