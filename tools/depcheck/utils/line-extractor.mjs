/**
 * line-extractor.mjs — Utility for extracting the import line number from dependency-cruiser report
 * 
 * Extracts the line number from a dependency-cruiser dependency object.
 * Supports various dependency-cruiser output formats
 * depending on the version.
 */

/**
 * Extracts the import line number from a dependency object, if available.
 * Supports different JSON output formats from dependency-cruiser.
 *
 * @param {object} dep - Dependency object from dependency-cruiser
 * @returns {number|null} - Line number or null if not found
 */
export function getImportLine(dep) {
  // Try via[0].line (most accurate if present)
  if (Array.isArray(dep.via) && dep.via.length > 0 && typeof dep.via[0].line === 'number') {
    return dep.via[0].line;
  }
  // Try dep.source.line
  if (dep.source && typeof dep.source.line === 'number') {
    return dep.source.line;
  }
  // Try dep.resolved.line
  if (dep.resolved && typeof dep.resolved.line === 'number') {
    return dep.resolved.line;
  }
  return null;
}
