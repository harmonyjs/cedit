/**
 * Unit tests for the Event Bus module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  bus, 
  BusEventType, 
  BusNamespace,
  emitInitConfig,
  emitDomainEvent,
  emitFinishSummary,
  emitFinishAbort
} from '../src/app/bus/index.js';
import type { 
  CliConfig, 
  FileViewed,
  ErrorRaised
} from '../src/app/model/index.js';

// Mock the logging module
vi.mock('../src/infra/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

// Create a minimal CliConfig for testing
const mockConfig: CliConfig = {
  anthropic_api_key: 'test-key',
  model: 'test-model',
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

// Create mock domain events for testing
const mockFileViewedEvent: FileViewed = {
  type: 'FileViewed',
  path: '/test/file.txt',
  lines: 10
};

const mockErrorEvent: ErrorRaised = {
  type: 'ErrorRaised',
  message: 'Test error',
  code: 'TEST_ERROR'
};

describe('Event Bus', () => {
  // Clear all listeners before each test
  beforeEach(() => {
    bus.clearAllListeners();
  });

  // Clear all listeners after each test
  afterEach(() => {
    bus.clearAllListeners();
  });

  describe('Basic functionality', () => {
    it('should be a singleton instance', () => {
      expect(bus).toBeDefined();
    });

    it('should emit and receive events', () => {
      const listener = vi.fn();
      bus.onTyped(BusEventType.INIT_CONFIG, listener);
      
      emitInitConfig(mockConfig);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        config: mockConfig
      }));
    });

    it('should support one-time listeners', () => {
      const listener = vi.fn();
      bus.onceTyped(BusEventType.INIT_CONFIG, listener);
      
      emitInitConfig(mockConfig);
      emitInitConfig(mockConfig);
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from events', () => {
      const listener = vi.fn();
      bus.onTyped(BusEventType.INIT_CONFIG, listener);
      
      emitInitConfig(mockConfig);
      expect(listener).toHaveBeenCalledTimes(1);
      
      bus.offTyped(BusEventType.INIT_CONFIG, listener);
      
      emitInitConfig(mockConfig);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('Event namespacing', () => {
    it('should support namespace wildcards', () => {
      const namespaceListener = vi.fn();
      bus.onNamespace(BusNamespace.INIT, namespaceListener);
      
      emitInitConfig(mockConfig);
      
      expect(namespaceListener).toHaveBeenCalledTimes(1);
      expect(namespaceListener).toHaveBeenCalledWith(
        BusEventType.INIT_CONFIG,
        expect.objectContaining({ config: mockConfig })
      );
    });

    it('should support global wildcards', () => {
      const globalListener = vi.fn();
      bus.onAny(globalListener);
      
      emitInitConfig(mockConfig);
      emitDomainEvent(mockFileViewedEvent);
      
      expect(globalListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Helper functions', () => {
    it('should emit init config events', () => {
      const listener = vi.fn();
      bus.onTyped(BusEventType.INIT_CONFIG, listener);
      
      emitInitConfig(mockConfig);
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        config: mockConfig
      }));
    });

    it('should emit domain events with correct mapping', () => {
      const fileViewedListener = vi.fn();
      const errorListener = vi.fn();
      
      bus.onTyped(BusEventType.DOMAIN_FILE_VIEWED, fileViewedListener);
      bus.onTyped(BusEventType.DOMAIN_ERROR, errorListener);
      
      emitDomainEvent(mockFileViewedEvent);
      emitDomainEvent(mockErrorEvent);
      
      expect(fileViewedListener).toHaveBeenCalledWith(expect.objectContaining({
        event: mockFileViewedEvent
      }));
      
      expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({
        event: mockErrorEvent
      }));
    });

    it('should emit finish summary events', () => {
      const listener = vi.fn();
      bus.onTyped(BusEventType.FINISH_SUMMARY, listener);
      
      const stats = {
        filesEdited: 2,
        filesCreated: 1,
        backupsCreated: 3,
        totalEdits: {
          added: 10,
          removed: 5,
          changed: 2
        }
      };
      
      emitFinishSummary(stats, 1500);
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        stats,
        duration: 1500
      }));
    });

    it('should emit finish abort events', () => {
      const listener = vi.fn();
      bus.onTyped(BusEventType.FINISH_ABORT, listener);
      
      emitFinishAbort('Operation cancelled', 'USER_CANCEL');
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'Operation cancelled',
        code: 'USER_CANCEL'
      }));
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      // Enable validation for these tests
      bus.setValidation(true);
    });

    it('should validate init config events', () => {
      const invalidPayload = { timestamp: Date.now() };
      
      expect(() => {
        // @ts-ignore - intentionally passing invalid payload for test
        bus.emitTyped(BusEventType.INIT_CONFIG, invalidPayload);
      }).toThrow(/config is required/);
    });

    it('should validate domain events', () => {
      const invalidPayload = { timestamp: Date.now() };
      
      expect(() => {
        // @ts-ignore - intentionally passing invalid payload for test
        bus.emitTyped(BusEventType.DOMAIN_FILE_VIEWED, invalidPayload);
      }).toThrow(/event with type is required/);
    });

    it('should validate finish summary events', () => {
      const invalidPayload = { timestamp: Date.now() };
      
      expect(() => {
        // @ts-ignore - intentionally passing invalid payload for test
        bus.emitTyped(BusEventType.FINISH_SUMMARY, invalidPayload);
      }).toThrow(/stats is required/);
    });

    it('should validate finish abort events', () => {
      const invalidPayload = { timestamp: Date.now() };
      
      expect(() => {
        // @ts-ignore - intentionally passing invalid payload for test
        bus.emitTyped(BusEventType.FINISH_ABORT, invalidPayload);
      }).toThrow(/reason is required/);
    });

    it('should skip validation when disabled', () => {
      bus.setValidation(false);
      
      const invalidPayload = { timestamp: Date.now() };
      
      // This should not throw when validation is disabled
      // @ts-ignore - intentionally passing invalid payload for test
      expect(() => bus.emitTyped(BusEventType.INIT_CONFIG, invalidPayload)).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should allow setting debug mode', () => {
      expect(() => bus.setDebugMode(true)).not.toThrow();
      expect(() => bus.setDebugMode(false)).not.toThrow();
    });

    it('should allow setting max listeners', () => {
      expect(() => bus.setMaxListenersCount(100)).not.toThrow();
    });
  });
});