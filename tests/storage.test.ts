import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mock from 'mock-fs';
import { applyReplace, readFileLines, applyInsert, initStorage } from '../src/infra/storage/index.js';
import type { CliConfig, ReplaceCommand, InsertCommand } from '../src/app/model/index.js';

// Mock the logging module
vi.mock('../src/infra/logging/index.js', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}));

// Mock CliConfig for testing
const cfg: CliConfig = {
  anthropicApiKey: 'test-key',
  model: 'test-model',
  retries: 0,
  sleepBetweenRequestsMs: 0,
  log: { 
    level: 'info', 
    dir: '/log' 
  },
  backup: {
    dir: '/bak',
    keepForDays: 7
  },
  defaults: {
    dryRun: false,
    maxTokens: 1000,
    model: 'default-model',
    retries: 0,
    sleepBetweenRequestsMs: 0
  },
  dryRun: true,
  maxTokens: 1000,
  varsOverride: {}
};

// Initialize storage with config before tests
initStorage(cfg);

beforeEach(() => {
  // Set up a mock file system
  mock({
    'file.md': 'first\nsecond\nthird',
    'file.updated.md': '', // Add an empty file.updated.md for the test
    '/bak': {},
    '/log': {}
  });
});

afterEach(() => {
  // Restore the real file system
  mock.restore();
});

describe('storage applyReplace', () => {
  it('replaces lines safely in dryRun mode', async () => {
    const cmd: ReplaceCommand = {
      kind: 'str_replace',
      id: '1',
      path: 'file.md',
      lineFrom: 1,
      lineTo: 1,
      content: 'UPDATED'
    };
    
    const evt = await applyReplace(cmd, cfg);
    
    expect(evt.type).toBe('FileEdited');
    expect(evt.stats?.added).toBe(0);
    expect(evt.stats?.removed).toBe(0);
    expect(evt.stats?.changed).toBe(1);

    // Verify the .updated file content
    const updatedLines = await readFileLines('file.updated.md');
    expect(updatedLines).toEqual(['first', 'UPDATED', 'third']);

    // Verify original file is untouched
    const originalLines = await readFileLines('file.md');
    expect(originalLines).toEqual(['first', 'second', 'third']);
  });
});

describe('storage applyInsert', () => {
  it('inserts content after specified line in dryRun mode', async () => {
    const cmd: InsertCommand = {
      kind: 'insert',
      id: '2',
      path: 'file.md',
      after: 0, // After the first line (0-based index)
      content: 'INSERTED'
    };
    
    const evt = await applyInsert(cmd, cfg);
    
    expect(evt.type).toBe('FileEdited');
    expect(evt.stats?.added).toBe(1);
    expect(evt.stats?.removed).toBe(0);
    // The current implementation counts shifted lines as changed
    expect(evt.stats?.changed).toBe(2);

    // Verify the .updated file content
    const updatedLines = await readFileLines('file.updated.md');
    expect(updatedLines).toEqual(['first', 'INSERTED', 'second', 'third']);

    // Verify original file is untouched
    const originalLines = await readFileLines('file.md');
    expect(originalLines).toEqual(['first', 'second', 'third']);
  });
});