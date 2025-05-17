/**
 * no-downward-index-imports.mjs — Rule prohibiting import of child index.ts/js from parent directory
 * 
 * Prevents a parent module from importing index.ts/js from a child directory, which
 * violates the principle of directed dependencies in the project architecture.
 */

import path from 'node:path';
import { getImportLine } from '../utils/line-extractor.mjs';

/**
 * Rule metadata
 */
export const meta = {
  name: 'no-downward-index-imports',
  description: 'Prohibits imports of index.ts/js from child directories ("downward imports")',
  severity: 'error',
};

/**
 * Checks if the import is a "downward index import" (parent importing index.ts/js of a child directory)
 * 
 * @param {string} fromPath - Source file path
 * @param {string} toPath - Path to the imported file
 * @returns {boolean} - true if this is a downward index import
 */
function isDownwardIndexImport(fromPath, toPath) {
  if (!new RegExp(`${path.sep}index\\.(ts|js)$`).test(toPath)) {
    return false;
  }
  const fromDirs = path.dirname(fromPath).split(path.sep);
  const toDirs = path.dirname(toPath).split(path.sep);
  return (
    fromDirs.length > toDirs.length &&
    fromDirs.slice(0, toDirs.length).every((p, i) => p === toDirs[i])
  );
}

/**
 * Checks modules for violations of the no-downward-index-imports rule
 * 
 * @param {object} cruiserResult - dependency-cruiser result in JSON format
 * @returns {Array} - List of violations
 */
export function check(cruiserResult) {
  const violations = [];
  
  for (const mod of cruiserResult.modules) {
    for (const dep of mod.dependencies) {
      if (isDownwardIndexImport(mod.source, dep.resolved)) {
        const line = getImportLine(dep);
        violations.push({
          rule: meta.name,
          from: mod.source,
          to: dep.resolved,
          line,
        });
      }
    }
  }
  
  return violations;
}
