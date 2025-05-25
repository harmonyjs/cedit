#!/usr/bin/env node

/**
 * CLI entrypoint for cedit
 */

import { run } from './app/runner/index.js';
import { getLogger } from './infra/logging/index.js';
import { runCli } from './ui/cli/index.js'; // Updated import path

// Entry point - pass process.argv and real dependencies to runCli
runCli(process.argv, run, getLogger)
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    // Critical application-level error before logger initialization - console is required
    // eslint-disable-next-line no-restricted-properties
    console.error(`\nCritical Error: ${message}`);
    process.exit(1);
  });