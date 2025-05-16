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
import { runCli } from '../src/ui/cli/main.js'; // Updated import path
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
const runMock = vi.fn().mockImplementation(async (_specPath, _cfg) => {
  // Import bus here to avoid circular dependency
  const { bus, BusEventType } = await import('../src/app/bus/index.js');
  
  // Emit finish summary event
  bus.emitTyped(BusEventType.FINISH_SUMMARY, {
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
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mock environment variables
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });
  
  afterEach(() => {
    // Restore the real file system
    mock.restore();
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  it('should load local config with highest priority', async () => {
    // Set up mock file system with all config files
    mock({
      // Local config (highest priority)
      '.cedit.yml': 'model: local-model\ndry_run: true',
      
      // Global config in ~/.config/cedit/
      [path.join(homeDir, '.config', 'cedit')]: {
        'config.yml': 'model: global-config-model'
      },
      
      // Global config in ~/.cedit.yml
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model',
      
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Local config values should take precedence
    expect(config.model).toBe('local-model');
    expect(config.dry_run).toBe(true);
  });
  
  it('should fall back to global config in ~/.config/cedit/ if local config doesn\'t exist', async () => {
    // Set up mock file system without local config
    mock({
      // Global config in ~/.config/cedit/
      [path.join(homeDir, '.config', 'cedit')]: {
        'config.yml': 'model: global-config-model\ndry_run: true'
      },
      
      // Global config in ~/.cedit.yml
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model',
      
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Global config values from ~/.config/cedit/ should be used
    expect(config.model).toBe('global-config-model');
    expect(config.dry_run).toBe(true);
  });
  
  it('should fall back to global config in ~/.cedit.yml if other configs don\'t exist', async () => {
    // Set up mock file system with only ~/.cedit.yml
    mock({
      // Global config in ~/.cedit.yml
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model\ndry_run: true',
      
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Global config values from ~/.cedit.yml should be used
    expect(config.model).toBe('home-model');
    expect(config.dry_run).toBe(true);
  });
  
  it('should use default values if no config files exist', async () => {
    // Set up mock file system without any config files
    mock({
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Default values should be used
    expect(config.model).toBe('claude-3-sonnet-20240229'); // Default model
    expect(config.dry_run).toBe(false); // Default dry_run
  });
  
  it('should handle malformed config files gracefully', async () => {
    // Set up mock file system with malformed config
    mock({
      // Malformed local config - this is truly malformed YAML that will cause a parsing error
      '.cedit.yml': 'model: local-model\ndry_run: true\n  - invalid: [yaml: syntax',
      
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments
    const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with default config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Default values should be used since config file was malformed
    expect(config.model).toBe('claude-3-sonnet-20240229');
    expect(config.dry_run).toBe(false);
    
    // Verify that a warning was logged
    expect(console.warn).toHaveBeenCalled();
  });
  
  it('should override config file values with CLI arguments', async () => {
    // Set up mock file system with config file
    mock({
      // Local config
      '.cedit.yml': 'model: local-model\ndry_run: false',
      
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments including overrides
    const args = [
      'node',
      'src/ui/cli/index.js',
      'spec.yml',
      '--yes',
      '--dry-run',
      '--model=cli-model'
    ];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // CLI arguments should override config file values
    expect(config.model).toBe('cli-model');
    expect(config.dry_run).toBe(true);
  });
  
  it('should correctly parse variable overrides from CLI arguments', async () => {
    // Set up mock file system
    mock({
      // Mock package.json for version reading
      'package.json': JSON.stringify({ version: '0.1.0-test' }),
      
      // Mock spec file
      'spec.yml': 'system: test\nuser: test\nvariables: {}',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Run the CLI with arguments including variable overrides
    const args = [
      'node',
      'src/ui/cli/index.js',
      'spec.yml',
      '--yes',
      '--var', 'key1=value1',
      '--var', 'key2=value2'
    ];
    await runCli(args, runMock, getLoggerMock);
    
    // Verify that run was called with the correct config
    expect(runMock).toHaveBeenCalled();
    const config = runMock.mock.calls[0][1];
    
    // Variable overrides should be correctly parsed
    expect(config.varsOverride).toEqual({
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  describe('loadConfigFile function', () => {
    it('should load local config file if it exists', async () => {
      // Set up mock file system with only local config
      mock({
        '.cedit.yml': 'model: local-model\ndry_run: true',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFile();
      
      expect(config).toEqual({
        model: 'local-model',
        dry_run: true
      });
    });
    
    it('should load global config from ~/.config/cedit/ if local config doesn\'t exist', async () => {
      // Set up mock file system without local config
      mock({
        // Global config in ~/.config/cedit/
        [path.join(homeDir, '.config', 'cedit')]: {
          'config.yml': 'model: global-config-model\ndry_run: true'
        },
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFile();
      
      expect(config).toEqual({
        model: 'global-config-model',
        dry_run: true
      });
    });
    
    it('should load global config from ~/.cedit.yml if other configs don\'t exist', async () => {
      // Set up mock file system without local config or ~/.config/cedit/
      mock({
        // Global config in ~/.cedit.yml
        [path.join(homeDir, '.cedit.yml')]: 'model: home-model\ndry_run: true',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFile();
      
      expect(config).toEqual({
        model: 'home-model',
        dry_run: true
      });
    });
    
    it('should return empty object if no config files exist', async () => {
      // Set up mock file system without any config files
      mock({
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      const config = await loadConfigFile();
      
      expect(config).toEqual({});
    });
    
    it('should handle malformed config files gracefully', async () => {
      // Set up mock file system with malformed config
      mock({
        '.cedit.yml': 'model: local-model\ndry_run: true\n  - invalid: [yaml: syntax',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn');
      
      const config = await loadConfigFile();
      
      // Should return empty object for malformed config
      expect(config).toEqual({});
      
      // Should log a warning
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toMatch(/Warning: Could not load or parse config file at .*?\.cedit\.yml: Nested mappings are not allowed in compact mappings at line \d+, column \d+:\n\s*dry_run: true\n\s*\^/);
    });
  });
  
  describe('CLI output', () => {
    it('should display summary stats with correct formatting', async () => {
      // Set up mock file system
      mock({
        // Mock package.json for version reading
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        
        // Mock spec file
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      // Clear previous mock calls
      vi.clearAllMocks();
      
      // Run the CLI with arguments
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      await runCli(args, runMock, getLoggerMock);
      
      // Verify that console.log was called with the expected formatted output
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Edits Applied:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+5'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('-2'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('~3'));
    });
    
    it('should display errors with correct formatting', async () => {
      // Set up mock file system
      mock({
        // Mock package.json for version reading
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        
        // Mock spec file
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      // Clear previous mock calls
      vi.clearAllMocks();
      
      // Mock runner to emit error events
      runMock.mockImplementationOnce(async (_specPath, _cfg) => {
        // Import bus here to avoid circular dependency
        const { bus, BusEventType } = await import('../src/app/bus/index.js');
        
        // Emit domain error event
        bus.emitTyped(BusEventType.DOMAIN_ERROR, {
          timestamp: Date.now(),
          event: { type: 'ErrorRaised', message: 'Test error', path: 'file.txt' } as any
        });
        
        // Emit finish abort event
        bus.emitTyped(BusEventType.FINISH_ABORT, {
          timestamp: Date.now(),
          reason: 'Test error',
          code: 'TEST_ERROR'
        });
      });
      
      // Run the CLI with arguments
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      await runCli(args, runMock, getLoggerMock);
      
      // Verify that console.log was called with the expected error output
      // With the new event-based approach, we get the abort message instead of the error summary
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Aborted: Test error'));
    });
    
    it('should verify that CLI runs without errors', async () => {
      // Set up mock file system
      mock({
        // Mock package.json for version reading
        'package.json': JSON.stringify({ version: '0.1.0-test' }),
        
        // Mock spec file
        'spec.yml': 'system: test\nuser: test\nvariables: {}',
        
        // Mock temp directories
        [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
        [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
      });
      
      // Clear previous mock calls
      vi.clearAllMocks();
      
      // Run the CLI with arguments
      const args = ['node', 'src/ui/cli/index.js', 'spec.yml', '--yes'];
      const exitCode = await runCli(args, runMock, getLoggerMock);
      
      // Verify that CLI ran successfully
      expect(exitCode).toBe(0);
      expect(runMock).toHaveBeenCalled();
      
      // Verify that bus events were emitted
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Edits Applied:'));
    });
  });
});

describe('loadCliConfig', () => {
  const homeDir = os.homedir(); // Define homeDir here

  beforeEach(() => {
    // Mock console.log to prevent test output clutter
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should load local config file if it exists', async () => {
    // Set up mock file system with only local config
    mock({
      '.cedit.yml': 'model: local-model\ndry_run: true',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const config = await loadConfigFile();
    
    expect(config).toEqual({
      model: 'local-model',
      dry_run: true
    });
  });
  
  it('should load global config from ~/.config/cedit/ if local config doesn\'t exist', async () => {
    // Set up mock file system without local config
    mock({
      // Global config in ~/.config/cedit/
      [path.join(homeDir, '.config', 'cedit')]: {
        'config.yml': 'model: global-config-model\ndry_run: true'
      },
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const config = await loadConfigFile();
    
    expect(config).toEqual({
      model: 'global-config-model',
      dry_run: true
    });
  });
  
  it('should load global config from ~/.cedit.yml if other configs don\'t exist', async () => {
    // Set up mock file system without local config or ~/.config/cedit/
    mock({
      // Global config in ~/.cedit.yml
      [path.join(homeDir, '.cedit.yml')]: 'model: home-model\ndry_run: true',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const config = await loadConfigFile();
    
    expect(config).toEqual({
      model: 'home-model',
      dry_run: true
    });
  });
  
  it('should return empty object if no config files exist', async () => {
    // Set up mock file system without any config files
    mock({
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    const config = await loadConfigFile();
    
    expect(config).toEqual({});
  });
  
  it('should handle malformed config files gracefully', async () => {
    // Set up mock file system with malformed config
    mock({
      '.cedit.yml': 'model: local-model\ndry_run: true\n  - invalid: [yaml: syntax',
      
      // Mock temp directories
      [path.join(os.tmpdir(), 'cedit', 'logs')]: {},
      [path.join(os.tmpdir(), 'cedit', 'backups')]: {}
    });
    
    // Spy on console.warn
    const warnSpy = vi.spyOn(console, 'warn');
    
    const config = await loadConfigFile();
    
    // Should return empty object for malformed config
    expect(config).toEqual({});
    
    // Should log a warning
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/Warning: Could not load or parse config file at .*?\.cedit\.yml: Nested mappings are not allowed in compact mappings at line \d+, column \d+:\n\s*dry_run: true\n\s*\^/);
  });
});