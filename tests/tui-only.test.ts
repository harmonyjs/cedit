/**
 * TUI Component and Integration Tests
 *
 * This file contains all the tests for the TUI module, including direct
 * component tests and event bus integration tests. It replaces the previous
 * separate tui.test.ts and tui-only.test.ts files.
 */

import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import type { CliConfig, DomainEvent } from '../src/app/model/index.js';
import { BUS_EVENT_TYPE, BUS_NAMESPACE, type FinishAbortEvent, type FinishSummaryEvent } from '../src/app/bus/index.js';

// Mock node:fs with proper default export
vi.mock('node:fs', () => {
  const mockFs = {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn()
    }),
    constants: { R_OK: 4 }
  };
  return {
    default: mockFs,
    ...mockFs
  };
});

// Mock node:fs/promises
vi.mock('node:fs/promises', () => {
  return {
    default: {
      access: vi.fn(),
      copyFile: vi.fn(),
      open: vi.fn(),
      rename: vi.fn(),
      truncate: vi.fn()
    }
  };
});

// Mock pino logger
vi.mock('pino', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis()
  };
  
  // Create a function with properties to mimic pino
  const mockPinoFn: any = vi.fn().mockReturnValue(mockLogger);
  
  // Add properties directly to the function
  mockPinoFn.stdTimeFunctions = {
    isoTime: vi.fn().mockReturnValue('2025-05-21T12:00:00.000Z')
  };
  
  return {
    pino: mockPinoFn,
    destination: vi.fn().mockReturnValue({ write: vi.fn() }),
    transport: vi.fn().mockReturnValue({ target: 'pino/file' })
  };
});

// Mock getVersion from version-manager
vi.mock('../src/ui/cli/services/version-manager.js', () => ({
  getVersion: vi.fn().mockReturnValue('0.1.0-test-mock')
}));

// Mock @clack/prompts before importing any modules that use it
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
      warn: vi.fn(),
      message: vi.fn()
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

// Import the TUI components that we want to test directly
import { displayInitialInfo } from '../src/ui/tui/init-info/index.js';
import {
  handleFileViewedEvent,
  handleFileEditedEvent,
  handleErrorRaisedEvent
} from '../src/ui/tui/domain-handlers/index.js';
import {
  handleFinishSummaryListener,
  handleFinishAbortListener
} from '../src/ui/tui/event-listeners/index.js';
import {
  isTUIEnvironment,
  showConfirmation,
  createSpinner,
  cleanupTUI,
  confirmApplyChanges,
  startLLMProcessing,
  updateSpinnerWithEvent,
  initTUI // Added initTUI
} from '../src/ui/tui/index.js';
import { gatherUserInput } from '../src/ui/tui/user-input.js';
import { bus } from '../src/app/bus/index.js'; // Removed unused imports BUS_EVENT_TYPE, BUS_NAMESPACE
import * as initInfoModule from '../src/ui/tui/init-info/index.js'; // For spying

// Clear mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Ensure TTY environment for tests
beforeAll(() => {
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: true
  });
});

describe('TUI Component Tests', () => {
  it('should detect TTY environment correctly', () => {
    // Import isTUIEnvironment directly to test
    // const { isTUIEnvironment } = require('../src/ui/tui/index.js'); // Removed
    // Test with TTY environment
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    expect(isTUIEnvironment()).toBe(true);
    // Test with non-TTY environment
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
    expect(isTUIEnvironment()).toBe(false);
    // Reset to TTY for other tests
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
  });

  it('should show confirmation dialog', async () => {
    // const { showConfirmation } = require('../src/ui/tui/index.js'); // Removed
    const result = await showConfirmation('Test confirmation');
    expect(clack.confirm).toHaveBeenCalledWith({ message: 'Test confirmation' });
    expect(result).toBe(true);
  });

  it('should create spinner', () => {
    // const { createSpinner } = require('../src/ui/tui/index.js'); // Removed
    const spin = createSpinner('Test spinner');
    expect(clack.spinner).toHaveBeenCalled();
    expect(spin).not.toBeNull();
    expect(spin?.start).toHaveBeenCalledWith('Test spinner');
  });

  it('should clean up TUI', () => {
    // Mock bus.clearAllListeners
    // const { cleanupTUI } = require('../src/ui/tui/index.js'); // Removed
    // const bus = require('../src/app/bus/index.js').bus; // Removed
    const clearAllListenersSpy = vi.spyOn(bus, 'clearAllListeners');
    cleanupTUI();
    expect(clearAllListenersSpy).toHaveBeenCalled();
  });

  it('should gather user input', async () => {
    // const { gatherUserInput } = require('../src/ui/tui/user-input.js'); // Removed
    // Patch the mock to allow .mockResolvedValueOnce
    const textMock = clack.text as unknown as { mockResolvedValueOnce: (v: any) => void };
    const selectMock = clack.select as unknown as { mockResolvedValueOnce: (v: any) => void };
    textMock.mockResolvedValueOnce('spec.yml');
    textMock.mockResolvedValueOnce('key=value');
    textMock.mockResolvedValueOnce('');
    selectMock.mockResolvedValueOnce(true);
    const result = await gatherUserInput();
    expect(clack.text).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Spec file') })
    );
    expect(clack.text).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Variable') })
    );
    expect(clack.select).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Dry‑run') })
    );
    expect(result).toEqual({ specPath: 'spec.yml', variables: { key: 'value' }, dryRun: true });
  });

  it('should confirm apply changes', async () => {
    // const { confirmApplyChanges } = require('../src/ui/tui/index.js'); // Removed
    const result = await confirmApplyChanges();
    expect(clack.select).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Apply these changes') })
    );
    expect(result).toBe(true);
  });

  it('should start LLM processing', () => {
    // const { startLLMProcessing } = require('../src/ui/tui/index.js'); // Removed
    const spin = startLLMProcessing();
    expect(clack.spinner).toHaveBeenCalled();
    expect(spin).not.toBeNull();
    expect(spin?.start).toHaveBeenCalledWith('Sending to Claude...');
  });

  it('should update spinner with event', () => {
    // const { createSpinner, updateSpinnerWithEvent } = require('../src/ui/tui/index.js'); // Removed
    const spin = createSpinner('Test spinner');
    updateSpinnerWithEvent({
      type: 'FileViewed',
      path: 'test.txt',
      lines: 10
    } as DomainEvent); // Added type assertion for clarity
    expect(spin?.message).toHaveBeenCalledWith(
      expect.stringContaining('Viewing')
    );
  });
  // Test for displayInitialInfo
  it('should display initial info correctly', () => {
    // Create test config
    const config: CliConfig = {
      model: 'test-model',
      dryRun: true,
      anthropicApiKey: 'test-key',
      retries: 3,
      sleepBetweenRequestsMs: 1000,
      log: { level: 'info', dir: '/tmp/logs' },
      backup: { dir: '/tmp/backups', keepForDays: 0 },
      defaults: {
        dryRun: false,
        maxTokens: 200000,
        model: 'default-model',
        retries: 2,
        sleepBetweenRequestsMs: 500
      },
      maxTokens: 200000,
      varsOverride: {}
    };
    
    // Call function directly
    displayInitialInfo(config, () => '0.1.0-test');
    
    // Verify that intro was called
    expect(clack.intro).toHaveBeenCalled();
    
    // Verify that log.info was called with model info
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('test-model')
    );
    
    // Verify that log.warn was called for dry run warning
    expect(clack.log.warn).toHaveBeenCalled();
  });
  
  // Test the domain handlers directly
  it('should handle FileViewed events correctly', () => {
    const fileViewedEvent = {
      type: 'FileViewed',
      path: 'test.txt',
      lines: 10
    } as any;
    
    handleFileViewedEvent(fileViewedEvent, null);
    
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('test.txt')
    );
  });
  
  it('should handle FileEdited events correctly', () => {
    const fileEditedEvent = {
      type: 'FileEdited',
      path: 'test.txt',
      lines: 10,
      stats: {
        added: 5,
        removed: 2,
        changed: 3
      }
    } as any;
    
    handleFileEditedEvent(fileEditedEvent);
    
    expect(clack.log.success).toHaveBeenCalledWith(
      expect.stringContaining('test.txt')
    );
  });
  
  it('should handle ErrorRaised events correctly', () => {
    const errorEvent = {
      type: 'ErrorRaised',
      message: 'Test error'
    } as any;
    
    handleErrorRaisedEvent(errorEvent, null);
    
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Error:')
    );
  });
  
  // Test the event listeners directly
  it('should handle FINISH_SUMMARY event correctly', () => {
    const summaryPayload = {
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
    };
    
    handleFinishSummaryListener(summaryPayload);
    
    expect(clack.log.step).toHaveBeenCalledWith('Summary:');
    expect(clack.log.info).toHaveBeenCalled();
    expect(clack.outro).toHaveBeenCalled();
  });
  
  it('should handle FINISH_ABORT event correctly', () => {
    const abortPayload = {
      timestamp: Date.now(),
      reason: 'Test error',
      code: 'TEST_ERROR'
    };
    
    handleFinishAbortListener(abortPayload);
    
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Aborted:')
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Code:')
    );
  });
});

describe('TUI Event Bus Integration Tests', () => {
  const mockCliConfig: CliConfig = {
    anthropicApiKey: 'test-key',
    model: 'test-model',
    retries: 3,
    sleepBetweenRequestsMs: 1000,
    log: {
      level: 'info',
      dir: '/tmp/logs'
    },
    backup: {
      dir: '/tmp/backups',
      keepForDays: 0
    },
    defaults: {
      dryRun: false,
      maxTokens: 200000,
      model: 'default-test-model',
      retries: 2,
      sleepBetweenRequestsMs: 500
    },
    dryRun: false,
    maxTokens: 200000,
    varsOverride: {}
  };

  beforeEach(() => {
    cleanupTUI(); // Clears listeners from bus, important for these tests
    // vi.clearAllMocks() is already in the global beforeEach
  });

  it('should initialize TUI and set up event listeners', () => {
    const onTypedSpy = vi.spyOn(bus, 'onTyped');
    const onNamespaceSpy = vi.spyOn(bus, 'onNamespace');
    
    initTUI(mockCliConfig);
    
    expect(onTypedSpy).toHaveBeenCalledWith(
      BUS_EVENT_TYPE.INIT_CONFIG,
      expect.any(Function)
    );
    expect(onNamespaceSpy).toHaveBeenCalledWith(
      BUS_NAMESPACE.DOMAIN,
      expect.any(Function)
    );
    expect(onTypedSpy).toHaveBeenCalledWith(
      BUS_EVENT_TYPE.FINISH_SUMMARY,
      expect.any(Function)
    );
    expect(onTypedSpy).toHaveBeenCalledWith(
      BUS_EVENT_TYPE.FINISH_ABORT,
      expect.any(Function)
    );
  });

  it('should display domain events correctly via bus', () => {
    initTUI(mockCliConfig);

    // FileViewed event
    const fileViewedEventPayload = {
      timestamp: Date.now(),
      event: {
        type: 'FileViewed',
        path: 'test.txt',
        lines: 10
      } as DomainEvent
    };
    bus.emitTyped(BUS_EVENT_TYPE.DOMAIN_FILE_VIEWED, fileViewedEventPayload);
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('test.txt')
    );
    vi.clearAllMocks(); // Clear for the next event assertion

    // FileEdited event
    const fileEditedEventPayload = {
      timestamp: Date.now(),
      event: {
        type: 'FileEdited',
        path: 'test-edited.txt', // Different path for clarity
        lines: 12,
        stats: {
          added: 5,
          removed: 2,
          changed: 3
        }
      } as DomainEvent
    };
    bus.emitTyped(BUS_EVENT_TYPE.DOMAIN_FILE_EDITED, fileEditedEventPayload);
    expect(clack.log.success).toHaveBeenCalledWith(
      expect.stringContaining('test-edited.txt')
    );
    vi.clearAllMocks(); // Clear for the next event assertion

    // ErrorRaised event
    const errorRaisedEventPayload = {
      timestamp: Date.now(),
      event: {
        type: 'ErrorRaised',
        message: 'Test bus error'
      } as DomainEvent
    };
    bus.emitTyped(BUS_EVENT_TYPE.DOMAIN_ERROR, errorRaisedEventPayload);
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Error: Test bus error')
    );
  });

  it('should display summary when FINISH_SUMMARY event is received via bus', () => {
    initTUI(mockCliConfig);
    const summaryPayload = {
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
    };
    bus.emitTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, summaryPayload);

    expect(clack.log.step).toHaveBeenCalledWith('Summary:');
    expect(clack.log.info).toHaveBeenCalledWith(expect.stringContaining('Files:'));
    expect(clack.log.info).toHaveBeenCalledWith(expect.stringContaining('Changes:'));
    expect(clack.log.info).toHaveBeenCalledWith(expect.stringContaining('Duration:'));
    expect(clack.outro).toHaveBeenCalled();
  });

  it('should display abort message when FINISH_ABORT event is received via bus', () => {
    initTUI(mockCliConfig);
    const abortPayload = {
      timestamp: Date.now(),
      reason: 'Test bus abort reason',
      code: 'TEST_BUS_ABORT_ERROR'
    };
    bus.emitTyped(BUS_EVENT_TYPE.FINISH_ABORT, abortPayload);

    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Aborted: Test bus abort reason')
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining('Code: TEST_BUS_ABORT_ERROR')
    );
    expect(clack.outro).toHaveBeenCalled();
  });
});
