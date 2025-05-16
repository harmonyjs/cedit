/**
 * Unit tests for the logging infrastructure
 */

import { describe, it, expect } from 'vitest';
import { getLogger } from '../src/infra/logging/index.js';
import type { CliConfig } from '../src/app/model/index.js';

// Create a minimal CliConfig for testing
const cfg: CliConfig = {
  anthropic_api_key: '',
  model: '',
  retries: 1,
  sleep_between_requests_ms: 0,
  log: {
    level: 'info',
    dir: '/tmp/cedit-tests'
  },
  backup: {
    dir: '/tmp',
    keep_for_days: 0
  },
  defaults: {
    dry_run: false,
    max_tokens: 0
  }
};

describe('logging', () => {
  it('creates singleton and child', () => {
    const a = getLogger('test', cfg);
    const b = getLogger('other');
    
    // Check that the loggers have the correct scope bindings
    expect(a.bindings().scope).toBe('test');
    expect(b.bindings().scope).toBe('other');
  });
});