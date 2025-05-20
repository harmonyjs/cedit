/**
 * CLI Config Loading Tests
 *
 * These tests focus on testing the configuration loading functionality of the CLI,
 * specifically how it loads and merges configuration from different sources:
 * 1. Local .cedit.yml (highest priority)
 * 2. Global ~/.config/cedit/config.yml
 * 3. Global ~/.cedit.yml
 * 4. Default values (lowest priority)
 */

import mock from 'mock-fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCli } from '../src/ui/cli/index.js';
import { loadConfigFile } from '../src/ui/cli/config/loader.js'; // Updated import path

// Mock @clack/prompts functions to prevent console output during tests
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn()
  })),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn()
}));

// Mock runner function and emit events on the bus
// These mocks are defined once and cleared in beforeEach
const runMock = vi.fn().mockImplementation(async (_specPath, _cfg) => {
  // Import bus here to avoid circular dependency
  const { bus, BUS_EVENT_TYPE } = await import('../src/app/bus/index.js');
  
  // Emit finish summary event
  bus.emitTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, {
    timestamp: Date.now(),
    stats: {
      filesEdited: 3,
      filesCreated: 1,
      backupsCreated: 2,
      totalEdits: { added: 5, removed: 2, changed: 3 }
    },
    duration: 1000
  });
  
  // No return value needed since we've changed the run function to return void
});

// Mock logger
const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn()
};
loggerMock.child.mockReturnValue(loggerMock);
const getLoggerMock = vi.fn().mockReturnValue(loggerMock);


// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock process.exit to prevent tests from exiting
vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

describe('CLI Config Loading', () => {
  const homeDir = os.homedir();
  let runCliInternal: typeof runCli; 
  let loadConfigFileInternal: typeof loadConfigFile;
  
  beforeEach(async () => {
    vi.resetModules(); 

    const cliIndex = await import('../src/ui/cli/index.js');
    runCliInternal = cliIndex.runCli;
    const configLoaderModule = await import('../src/ui/cli/config/loader.js');
    loadConfigFileInternal = configLoaderModule.loadConfigFile;

    mock.restore(); 
    vi.clearAllMocks(); 

    // Explicitly reset mock implementations to ensure they are fresh for each test
    runMock.mockImplementation(async (_specPath, _cfg) => {
      const { bus, BUS_EVENT_TYPE } = await import('../src/app/bus/index.js');
      bus.emitTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, {
        timestamp: Date.now(),
        stats: {
          filesEdited: 3,
          filesCreated: 1,
          backupsCreated: 2,
          totalEdits: { added: 5, removed: 2, changed: 3 }
        },
        duration: 1000
      });
    });
    // Reset loggerMock's methods (already done by clearAllMocks if they are vi.fn())
    // and re-assign getLoggerMock implementation
    // loggerMock.info.mockClear(); etc. (covered by clearAllMocks)
    getLoggerMock.mockReturnValue(loggerMock);
    
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });
  
  afterEach(() => {
    mock.restore();
  });
  
  it('should load local config with highest priority', async () => {
    mock({
      '.cedit.yml': 'model: local-model\ndryRun: true',
      [path.join(homeDir, '.config', 'cedit')]: {
        'config.yml': 'model: global-config-model'
      },
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model',
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('local-model');
    expect(config.dryRun).toBe(true);
  });
  
  it("should fall back to global config in ~/.config/cedit/ if local config doesn't exist", async () => {
    mock({
      [path.join(homeDir, '.config', 'cedit')]: {
        'config.yml': 'model: global-config-model\ndryRun: true'
      },
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model',
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('global-config-model');
    expect(config.dryRun).toBe(true);
  });
  
  it("should fall back to global config in ~/.cedit.yml if other configs don't exist", async () => {
    mock({
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model\ndryRun: true',
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('home-model');
    expect(config.dryRun).toBe(true);
  });
  
  it('should use default values if no config files exist', async () => {
    mock({
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('claude-3-sonnet-20240229'); 
    expect(config.dryRun).toBe(false); 
  });
  
  it('should handle malformed config files gracefully', async () => {
    mock({
      '.cedit.yml': 'model: local-model\ndryRun: true\n  - invalid: [yaml: syntax',
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('claude-3-sonnet-20240229');
    expect(config.dryRun).toBe(false);
    
    expect(console.warn).toHaveBeenCalled();
  });
  
  it('should override config file values with CLI arguments', async () => {
    mock({
      '.cedit.yml': 'model: local-model\ndryRun: false',
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = [
      'node',
      'src/ui/cli/index.js',
      'spec.yml',
      '--yes',
      '--dry-run',
      '--model=cli-model'
    ];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.model).toBe('cli-model');
    expect(config.dryRun).toBe(true);
  });
  
  it('should correctly parse variable overrides from CLI arguments', async () => {
    mock({
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const args = [
      'node',
      'src/ui/cli/index.js',
      'spec.yml',
      '--yes',
      '--var', 'key1=value1',
      '--var', 'key2=value2'
    ];
    await runCliInternal(args, runMock, getLoggerMock); 
    
    expect(runMock).toHaveBeenCalled();
    // Shallow clone the config object
    const config = { ...runMock.mock.calls[0][1] };
    
    expect(config.varsOverride).toEqual({
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  describe('loadConfigFile function', () => {
    it('should load local config file if it exists', async () => {
      mock({
        '.cedit.yml': 'model: local-model\ndryRun: true',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFileInternal(); 
      
      expect(config).toEqual({
        model: 'local-model',
        dryRun: true
      });
    });
    
    it("should load global config from ~/.config/cedit/ if local config doesn't exist", async () => {
      mock({
        [path.join(homeDir, '.config', 'cedit')]: {
          'config.yml': 'model: global-config-model\ndryRun: true'
        },
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFileInternal(); 
      
      expect(config).toEqual({
        model: 'global-config-model',
        dryRun: true
      });
    });
    
    it("should load global config from ~/.cedit.yml if other configs don't exist", async () => {
      mock({
        [path.join(homeDir, '.cedit.yml')]: 'model: home-model\ndryRun: true',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFileInternal(); 
      
      expect(config).toEqual({
        model: 'home-model',
        dryRun: true
      });
    });
    
    it('should return empty object if no config files exist', async () => {
      mock({
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFileInternal(); 
      
      expect(config).toEqual({});
    });
    
    it('should handle malformed config files gracefully', async () => {
      mock({
        '.cedit.yml': 'model: local-model\ndryRun: true\n  - invalid: [yaml: syntax',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const warnSpy = vi.spyOn(console, 'warn');
      
      const config = await loadConfigFileInternal(); 
      
      expect(config).toEqual({});
      
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toMatch(/Warning: Could not load or parse config file at .*?\.cedit\.yml: Nested mappings are not allowed in compact mappings at line \d+, column \d+:/);
    });
  });
  
  describe('CLI output', () => {
    it('should display summary stats with correct formatting', async () => {
      mock({
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      await runCliInternal(args, runMock, getLoggerMock); 
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Edits Applied:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+5'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('-2'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('~3'));
    });
    
    it('should display errors with correct formatting', async () => {
      mock({
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      runMock.mockImplementationOnce(async (_specPath, _cfg) => {
        const { bus, BUS_EVENT_TYPE } = await import('../src/app/bus/index.js');
        bus.emitTyped(BUS_EVENT_TYPE.DOMAIN_ERROR, {
          timestamp: Date.now(),
          event: { type: 'ErrorRaised', message: 'Test error', path: 'file.txt' } as any
        });
        bus.emitTyped(BUS_EVENT_TYPE.FINISH_ABORT, {
          timestamp: Date.now(),
          reason: 'Test error',
          code: 'TEST_ERROR'
        });
      });
      
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      await runCliInternal(args, runMock, getLoggerMock); 
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Aborted: Test error'));
    });
    
    it('should verify that CLI runs without errors', async () => {
      mock({
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      const exitCode = await runCliInternal(args, runMock, getLoggerMock); 
      
      expect(exitCode).toBe(0);
      expect(runMock).toHaveBeenCalled();
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Edits Applied:'));
    });
  });
});

