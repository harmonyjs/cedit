/**
 * TUI Unit Tests
 *
 * These tests focus on testing the TUI functionality in isolation,
 * without worrying about the integration with the rest of the system.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { bus, BusEventType, BusNamespace } from '../src/app/bus/index.js';
import type { CliConfig, DomainEvent } from '../src/app/model/index.js';

 // Mock @clack/prompts
 vi.mock('@clack/prompts', () => {
   const confirm = vi.fn().mockResolvedValue(true);
   const select = vi.fn().mockResolvedValue(true);
   const text = vi.fn().mockResolvedValue('test');
   const isCancel = vi.fn().mockReturnValue(false);
   return {
     intro: vi.fn(),
     outro: vi.fn(),
     log: {
       info: vi.fn(),
       step: vi.fn(),
       success: vi.fn(),
       error: vi.fn(),
       warn: vi.fn()
     },
     spinner: vi.fn(() => ({
       start: vi.fn(),
       stop: vi.fn(),
       message: vi.fn()
     })),
     confirm,
     text,
     select,
     isCancel,
     cancel: vi.fn(),
     note: vi.fn()
   };
 });

// Import the mocked clack
import * as clack from '@clack/prompts';

import * as tui from '../src/ui/tui/index.js';
import {
 initTUI,
 isTUIEnvironment,
 showConfirmation,
 createSpinner,
 cleanupTUI,
 confirmApplyChanges,
 startLLMProcessing,
 updateSpinnerWithEvent
} from '../src/ui/tui/index.js';
import { gatherUserInput } from '../src/ui/tui/user-input.js'; // Added import from new location

// Ensure TTY environment for tests
beforeAll(() => {
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: true
  });
});

describe('TUI Unit Tests', () => {
  
  it('should detect TTY environment correctly', () => {
    // Test with TTY environment
    const envSpy = vi.spyOn(tui, 'isTUIEnvironment').mockReturnValue(true);
    expect(isTUIEnvironment()).toBe(true);

    // Test with non-TTY environment
    envSpy.mockReturnValue(false);
    expect(isTUIEnvironment()).toBe(false);

    // Reset to TTY for other tests
    envSpy.mockReturnValue(true);
  });
  
  it('should initialize TUI and set up event listeners', () => {
    // Spy on bus methods
    const onTypedSpy = vi.spyOn(bus, 'onTyped');
    const onNamespaceSpy = vi.spyOn(bus, 'onNamespace');
    
    // Initialize TUI
    const config: CliConfig = {
      anthropic_api_key: 'test-key',
      model: 'test-model',
      retries: 3,
      sleep_between_requests_ms: 1000,
      log: {
        level: 'info',
        dir: '/tmp/logs'
      },
      backup: {
        dir: '/tmp/backups',
        keep_for_days: 0
      },
      defaults: {
        dry_run: false,
        max_tokens: 200000,
        model: 'default-test-model', // Added
        retries: 2, // Added
        sleep_between_requests_ms: 500 // Added
      },
      dry_run: false,
      max_tokens: 200000,
      varsOverride: {} // Added
    };
    
    initTUI(config);
    
    // Verify that event listeners were set up
    expect(onTypedSpy).toHaveBeenCalledWith(
      BusEventType.INIT_CONFIG,
      expect.any(Function)
    );
    
    expect(onNamespaceSpy).toHaveBeenCalledWith(
      BusNamespace.DOMAIN,
      expect.any(Function)
    );
    
    expect(onTypedSpy).toHaveBeenCalledWith(
      BusEventType.FINISH_SUMMARY,
      expect.any(Function)
    );
    
    expect(onTypedSpy).toHaveBeenCalledWith(
      BusEventType.FINISH_ABORT,
      expect.any(Function)
    );
  });
  
  it('should display intro when INIT_CONFIG event is received', () => {
    // Initialize TUI
    initTUI({} as CliConfig);
    
    // Emit INIT_CONFIG event
    bus.emitTyped(BusEventType.INIT_CONFIG, {
      timestamp: Date.now(),
      config: {
        model: 'test-model',
        dry_run: true
      } as CliConfig
    });
    
    // Verify that intro was called
    expect(clack.intro).toHaveBeenCalled();
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('test-model')
    );
    expect(clack.log.warn).toHaveBeenCalled(); // For dry run warning
  });
  
  it('should display domain events correctly', () => {
    // Initialize TUI
    initTUI({} as CliConfig);
    
    // Emit FileViewed event
    bus.emitTyped(BusEventType.DOMAIN_FILE_VIEWED, {
      timestamp: Date.now(),
      event: {
        type: 'FileViewed',
        path: 'test.txt',
        lines: 10
      } as DomainEvent
    });
    
    // Verify that log.info was called
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('test.txt')
    );
    
    // Emit FileEdited event
    bus.emitTyped(BusEventType.DOMAIN_FILE_EDITED, {
      timestamp: Date.now(),
      event: {
        type: 'FileEdited',
        path: 'test.txt',
        lines: 10,
        stats: {
          added: 5,
          removed: 2,
          changed: 3
        }
      } as DomainEvent
    });
    
    // Verify that log.success was called
    expect(clack.log.success).toHaveBeenCalledWith(
      expect.stringContaining('test.txt')
    );
    
    // Emit ErrorRaised event
    bus.emitTyped(BusEventType.DOMAIN_ERROR, {
      timestamp: Date.now(),
      event: {
        type: 'ErrorRaised',
        message: 'Test error'
      } as DomainEvent
    });
    
    // Verify that log.error was called
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Error:')
    );
  });
  
  it('should display summary when FINISH_SUMMARY event is received', () => {
    // Initialize TUI
    initTUI({} as CliConfig);
    
    // Emit FINISH_SUMMARY event
    bus.emitTyped(BusEventType.FINISH_SUMMARY, {
      timestamp: Date.now(),
      stats: {
        filesEdited: 3,
        filesCreated: 1,
        backupsCreated: 2,
        totalEdits: {
          added: 5,
          removed: 2,
          changed: 3
        }
      },
      duration: 1000
    });
    
    // Verify that log.step was called
    expect(clack.log.step).toHaveBeenCalledWith('Summary:');
    
    // Verify that log.info was called with stats
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Files:')
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Changes:')
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Duration:')
    );
    
    // Verify that outro was called
    expect(clack.outro).toHaveBeenCalled();
  });
  
  it('should display error when FINISH_ABORT event is received', () => {
    // Initialize TUI
    initTUI({} as CliConfig);
    
    // Emit FINISH_ABORT event
    bus.emitTyped(BusEventType.FINISH_ABORT, {
      timestamp: Date.now(),
      reason: 'Test error',
      code: 'TEST_ERROR'
    });
    
    // Verify that log.error was called
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Aborted:')
    );
    
    // Verify that log.info was called with code
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Code:')
    );
    
    // Verify that outro was called
    expect(clack.outro).toHaveBeenCalled();
  });
  
  it('should show confirmation dialog', async () => {
    const result = await showConfirmation('Test confirmation');
    
    // Verify that confirm was called
    expect(clack.confirm).toHaveBeenCalledWith({
      message: 'Test confirmation'
    });
    
    // Verify that result is true (mocked to return true)
    expect(result).toBe(true);
  });
  
  it('should create spinner', () => {
    const spin = createSpinner('Test spinner');
    
    // Verify that spinner was created
    expect(clack.spinner).toHaveBeenCalled();
    expect(spin).not.toBeNull();
    
    // Verify that spinner was started
    expect(spin?.start).toHaveBeenCalledWith('Test spinner');
  });
  
  it('should clean up TUI', () => {
    // Spy on bus.clearAllListeners
    const clearAllListenersSpy = vi.spyOn(bus, 'clearAllListeners');
    
    // Clean up TUI
    cleanupTUI();
    
    // Verify that clearAllListeners was called
    expect(clearAllListenersSpy).toHaveBeenCalled();
  });
  
  it('should gather user input', async () => {
    // Mock text and select to return specific values
    (clack.text as any).mockResolvedValueOnce('spec.yml');
    (clack.text as any).mockResolvedValueOnce('key=value');
    (clack.text as any).mockResolvedValueOnce(''); // Empty to finish variables
    (clack.select as any).mockResolvedValueOnce(true); // dry run = true
    
    const result = await gatherUserInput();
    
    // Verify that text was called for spec path
    expect(clack.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Spec file')
      })
    );
    
    // Verify that text was called for variables
    expect(clack.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Variable')
      })
    );
    
    // Verify that select was called for dry run
    expect(clack.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Dry‑run')
      })
    );
    
    // Verify that result contains expected values
    expect(result).toEqual({
      specPath: 'spec.yml',
      variables: { key: 'value' },
      dryRun: true
    });
  });
  
  it('should confirm apply changes', async () => {
    const result = await confirmApplyChanges();
    
    // Verify that select was called
    expect(clack.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Apply these changes')
      })
    );
    
    // Verify that result is true (mocked to return true)
    expect(result).toBe(true);
  });
  
  it('should start LLM processing', () => {
    const spin = startLLMProcessing();
    
    // Verify that spinner was created
    expect(clack.spinner).toHaveBeenCalled();
    expect(spin).not.toBeNull();
    
    // Verify that spinner was started
    expect(spin?.start).toHaveBeenCalledWith('Sending to Claude...');
  });
  
  it('should update spinner with event', () => {
    // Create spinner
    const spin = createSpinner('Test spinner');
    
    // Update spinner with event
    updateSpinnerWithEvent({
      type: 'FileViewed',
      path: 'test.txt',
      lines: 10
    } as DomainEvent);
    
    // Verify that spinner message was updated
    expect(spin?.message).toHaveBeenCalledWith(
      expect.stringContaining('Viewing')
    );
  });
});