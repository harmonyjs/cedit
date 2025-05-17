/**
 * index.mjs — Main module of the architecture rule verification system
 * 
 * Runs architecture rule checks for the project based on dependency-cruiser results
 * and processes the results using all defined rules.
 */

import { execa } from 'execa';
import chalk from 'chalk';
import { rules } from './rules/index.mjs';
import { formatReport } from './reporter.mjs';

// Constants for running dependency-cruiser
const DEP_CRUISE_CMD = 'npx';
const DEP_CRUISE_ARGS = ['depcruise', 'src', '--config', 'dependency-cruiser.cjs', '--output-type', 'json'];

/**
 * Processes a single dependency and adds violations to the list.
 * @param {object} dep - The dependency object from dependency-cruiser.
 * @param {object} mod - The module object from dependency-cruiser.
 * @param {Array} allViolations - The list to add violations to.
 */
function processDependency(dep, mod, allViolations) {
  if (!(dep.valid === false && Array.isArray(dep.rules) && dep.rules.length > 0)) {
    return;
  }

  for (const rule of dep.rules) {
    // Create violation message
    let message = 'Dependency-cruiser rule violation';
    if (rule.name === 'no-circular-deps' && Array.isArray(dep.cycle)) {
      // For circular dependencies, show the full cycle
      const cycleStr = dep.cycle.map(c => c.name).join(' → ');
      message = `Circular dependency: ${cycleStr}`;
    } else if (rule.name && rule.comment) {
      message = rule.comment;
    }

    // Add violation to the main list
    allViolations.push({
      rule: `depcruise:${rule.name}`,
      from: mod.source,
      to: dep.resolved || dep.module,
      line: null, // Unfortunately, line numbers are usually not available
      message: message
    });
  }
}

/**
 * Runs architecture rule checks
 * 
 * @returns {Promise<boolean>} true if violations are found, false if everything is OK
 */
export async function runChecks() {
  try {
    // Run dependency-cruiser with JSON output format
    const { stdout } = await execa(DEP_CRUISE_CMD, DEP_CRUISE_ARGS);
    const cruiserResult = JSON.parse(stdout);
    
    // Collect all violations from all sources
    const allViolations = [];
    
    // Process standard violations from dependency-cruiser by searching in 'modules'
    if (cruiserResult.summary.error > 0 && Array.isArray(cruiserResult.modules)) {
      // Iterate through all modules
      for (const mod of cruiserResult.modules) {
        if (!Array.isArray(mod.dependencies)) continue;

        // Look for problematic dependencies in each module
        for (const dep of mod.dependencies) {
          processDependency(dep, mod, allViolations);
        }
      }
    }

    // Run checks for each rule
    for (const rule of rules) {
      const ruleViolations = rule.check(cruiserResult);
      allViolations.push(...ruleViolations);
    }
    
    // Format and output the report
    return formatReport(allViolations);
    
  } catch (error) {
    console.error('Error during architecture checks:', error);
    return true; // Consider there are violations if an error occurred
  }
}
