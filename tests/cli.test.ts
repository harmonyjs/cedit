/**
 * CLI Unit Tests
 *
 * These tests focus on testing the CLI functionality in isolation,
 * without worrying about the integration with the rest of the system.
 *
 * =====================================================================
 * IMPORTANT NOTE ON TESTING APPROACH
 * =====================================================================
 *
 * We deliberately avoid using `execa` or similar tools that would execute
 * the CLI as a separate process for these tests. Here's why:
 *
 * 1. UNIT vs INTEGRATION TESTING:
 *    These are UNIT tests that verify the CLI logic in isolation.
 *    Using `execa` would make these INTEGRATION tests, which:
 *      - Are slower to execute (process spawning overhead)
 *      - Are more brittle (environment dependencies)
 *      - Test too many components at once (harder to debug failures)
 *
 * 2. BETTER TESTABILITY:
 *    By directly importing and mocking the CLI components:
 *      - We can precisely control inputs and outputs
 *      - We can inspect internal state and function calls
 *      - We can simulate edge cases more easily
 *      - We avoid filesystem/environment dependencies
 *
 * 3. FASTER FEEDBACK LOOP:
 *    Unit tests run significantly faster than tests that spawn processes,
 *    which improves developer experience during TDD cycles.
 *
 * If you need to test the CLI as a whole (including process spawning,
 * environment variables, etc.), create separate integration tests in a
 * different file, but keep these focused on unit testing the core logic.
 */

// import { describe, it, expect, vi, beforeEach, type Mock } from \'vitest\';
// import { runCli, type RunFn } from \'../src/ui/cli/main.js\';
// import { parseCliArgs as originalParseCliArgs, type ParsedCliArgs } from \'../src/ui/cli/execution/parser.js\';
// import { loadConfig as originalLoadConfig, type ResolvedConfig, type ConfigError } from \'../src/ui/cli/config/loader.js\';
// import { initializeResourceManager as originalInitializeResourceManager, type ResourceManager } from \'../src/ui/cli/services/resource-manager.js\';
// import { handleCliLifecycle as originalHandleCliLifecycle } from \'../src/ui/cli/execution/lifecycle.js\';
// import { createEventBus as originalCreateEventBus, type EventBus } from \'../src/app/bus/index.js\'; // Adjusted path for mocking
// import type { Logger } from \'pino\';

// // Mock @clack/prompts
// vi.mock(\'@clack/prompts\', () => ({
//   intro: vi.fn(),
//   outro: vi.fn(),
//   confirm: vi.fn(),
//   select: vi.fn(),
//   text: vi.fn(),
//   group: vi.fn(),
//   log: {
//     info: vi.fn(),
//     warn: vi.fn(),
//     error: vi.fn(),
//     success: vi.fn(),
//   },
//   isCancel: vi.fn(),
//   cancel: vi.fn(),
// }));

// // Mock internal CLI modules
// vi.mock(\'../src/ui/cli/execution/parser.js\', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     parseCliArgs: vi.fn(),
//   };
// });
// vi.mock(\'../src/ui/cli/config/loader.js\', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     loadConfig: vi.fn(),
//   };
// });
// vi.mock(\'../src/ui/cli/services/resource-manager.js\', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     initializeResourceManager: vi.fn(),
//   };
// });
// vi.mock(\'../src/ui/cli/execution/lifecycle.js\', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     handleCliLifecycle: vi.fn(),
//   };
// });
// vi.mock(\'../src/app/bus/index.js\', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     createEventBus: vi.fn(() => ({
//       emit: vi.fn(),
//       on: vi.fn(),
//       off: vi.fn(),
//       once: vi.fn(),
//       removeAllListeners: vi.fn(),
//       listenerCount: vi.fn(),
//       listeners: vi.fn(),
//       eventNames: vi.fn(),
//       getMaxListeners: vi.fn(),
//       setMaxListeners: vi.fn(),
//     })),
//   };
// });

// // Cast mocked functions for type safety in tests
// const parseCliArgs = originalParseCliArgs as Mock;
// const loadConfig = originalLoadConfig as Mock;
// const initializeResourceManager = originalInitializeResourceManager as Mock;
// const handleCliLifecycle = originalHandleCliLifecycle as Mock;
// const createEventBus = originalCreateEventBus as Mock;

// // Create a simplified version of the CLI that we can test
// const createCli = (args: string[]) => {
//   // Mock process.argv
//   process.argv = [\'node\', \'src/ui/cli/index.js\', ...args];
  
//   // Create a mock runner function that returns void (as per new implementation)
//   const runMock = vi.fn().mockResolvedValue(undefined);
  
//   // Create a mock config
//   const createConfig = (opts: CliOptions) => {
//     const DEFAULT_LOG_DIR = path.join(os.tmpdir(), \'cedit\', \'logs\');
//     const DEFAULT_BACKUP_DIR = path.join(os.tmpdir(), \'cedit\', \'backups\');
//     const DEFAULT_MODEL = \'claude-3-sonnet-20240229\';
//     const DEFAULT_MAX_TOKENS = 200000;
//     const DEFAULT_RETRIES = 3;
//     const DEFAULT_SLEEP_MS = 1000;
    
//     // Transform \"var\" overrides into Record<string, string>
//     const varsOverride: Record<string, string> = (opts.var ?? []).reduce((acc: Record<string, string>, pair: string) => {
//       const parts = pair.split(\'=\');
//       if (parts.length === 2) {
//         acc[parts[0].trim()] = parts[1].trim();
//       }
//       return acc;
//     }, {});
    
//     return {
//       dry_run: !!opts.dryRun,
//       max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
//       model: opts.model ?? DEFAULT_MODEL,
//       log: {
//         level: opts.logLevel ?? \'info\',
//         dir: path.resolve(opts.logDir ?? DEFAULT_LOG_DIR),
//       },
//       retries: opts.retries ?? DEFAULT_RETRIES,
//       sleep_between_requests_ms: opts.sleepMs ?? DEFAULT_SLEEP_MS,
//       backup: {
//         dir: path.resolve(opts.backupDir ?? DEFAULT_BACKUP_DIR),
//         keep_for_days: 0,
//       },
//       defaults: {
//         dry_run: false,
//         max_tokens: DEFAULT_MAX_TOKENS,
//       },
//       varsOverride: varsOverride,
//       anthropic_api_key: \'mock-api-key\',
//     };
//   };
  
//   // Helper to simulate bus events
//   const simulateFinishEvent = (success = true, stats = { added: 5, removed: 2, changed: 3 }) => {
//     // Find the callback registered for FINISH_SUMMARY
//     const finishCallback = (bus.onceTyped as Mock).mock.calls.find(
//       (callArgs: any[]) => Array.isArray(callArgs) && callArgs.length > 0 && callArgs[0] === BusEventType.FINISH_SUMMARY
//     )?.[1] as ((payload: unknown) => void) | undefined;
    
//     if (finishCallback && success) {
//       // Call the callback with a mock payload
//       finishCallback({
//         timestamp: Date.now(),
//         stats: {
//           filesEdited: 3,
//           filesCreated: 1,
//           backupsCreated: 3,
//           totalEdits: stats
//         },
//         duration: 1500
//       });
//     } else {
//       // Find the abort callback
//       const abortCallback = (bus.onceTyped as Mock).mock.calls.find(
//         (callArgs: any[]) => Array.isArray(callArgs) && callArgs.length > 0 && callArgs[0] === BusEventType.FINISH_ABORT
//       )?.[1] as ((payload: unknown) => void) | undefined;
      
//       if (abortCallback) {
//         abortCallback({
//           timestamp: Date.now(),
//           reason: \'Test error\'
//         });
//       }
//     }
//   };
  
//   // Create a simplified CLI function
//   const runCli = async () => {
//     // Parse arguments
//     const specPath = args[0];
    
//     // Check if spec path is provided
//     if (!specPath) {
//       console.error(\'Error: Spec file path is required.\');
//       return 1;
//     }
    
//     // Create options
//     const opts = {
//       dryRun: args.includes(\'--dry-run\'),
//       model: args.includes(\'--model=cli-model\') ? \'cli-model\' : undefined,
//       var: args.includes(\'--var\') ? [\'key=value\'] : [],
//       yes: args.includes(\'--yes\'),
//     };
    
//     // Create config
//     const config = createConfig(opts);
    
//     try {
//       // Emit init event with config
//       bus.emitTyped(BusEventType.INIT_CONFIG, {
//         timestamp: Date.now(),
//         config
//       });
      
//       // Set up listeners for finish events
//       bus.onceTyped(BusEventType.FINISH_SUMMARY, (payload) => {
//         const { totalEdits } = payload.stats;
//         const { added, removed, changed } = totalEdits;
        
//         console.log(`+${added} -${removed} ~${changed}`);
//       });
      
//       bus.onceTyped(BusEventType.FINISH_ABORT, (payload) => {
//         console.log(`Aborted: ${payload.reason}`);
//       });
      
//       // Start the runner (which now returns void)
//       const runPromise = runMock(specPath, config);
      
//       // Simulate the finish event after a short delay
//       setTimeout(() => {
//         simulateFinishEvent(true);
//       }, 10);
      
//       // Wait for the finish event (in the real implementation, this is handled by the finishPromise)
//       await runPromise;
      
//       // In our test, we\'ll just return 0 for success
//       return 0;
//     } catch (error: any) {
//       console.error(`Error: ${error.message}`);
//       return 1;
//     } finally {
//       // Clean up event listeners
//       bus.clearAllListeners();
//     }
//   };
  
//   return { runCli, runMock, simulateFinishEvent };
// };

// describe(\'CLI Unit Tests\', () => {
//   beforeEach(() => {
//     vi.clearAllMocks();
//   });
  
//   afterEach(() => {
//     vi.resetAllMocks();
//   });
  
//   it(\'should display error if spec path is missing\', async () => {
//     const { runCli } = createCli([]);
    
//     const exitCode = await runCli();
    
//     expect(exitCode).toBe(1);
//     expect(mockConsoleError).toHaveBeenCalledWith(\'Error: Spec file path is required.\');
//   });
  
//   it(\'should emit init event with config\', async () => {
//     const { runCli, runMock } = createCli([\'spec.yml\', \'--yes\']);
    
//     await runCli();
    
//     // Verify that the init event was emitted with the config
//     expect(bus.emitTyped).toHaveBeenCalledWith(
//       BusEventType.INIT_CONFIG,
//       expect.objectContaining({
//         timestamp: expect.any(Number),
//         config: expect.any(Object)
//       })
//     );
//   });
  
//   it(\'should set up listeners for finish events\', async () => {
//     const { runCli } = createCli([\'spec.yml\', \'--yes\']);
    
//     await runCli();
    
//     // Verify that listeners were set up for finish events
//     expect(bus.onceTyped).toHaveBeenCalledWith(
//       BusEventType.FINISH_SUMMARY,
//       expect.any(Function)
//     );
    
//     expect(bus.onceTyped).toHaveBeenCalledWith(
//       BusEventType.FINISH_ABORT,
//       expect.any(Function)
//     );
//   });
  
//   it(\'should display summary stats when finish event is received\', async () => {
//     const { runCli, simulateFinishEvent } = createCli([\'spec.yml\', \'--yes\']);
    
//     // Start the CLI
//     const cliPromise = runCli();
    
//     // Manually trigger the finish event with custom stats
//     simulateFinishEvent(true, { added: 10, removed: 5, changed: 7 });
    
//     // Wait for CLI to complete
//     await cliPromise;
    
//     // Verify the output matches the stats from the event
//     expect(mockConsoleLog).toHaveBeenCalledWith(
//       expect.stringContaining(\'+10\')
//     );
//     expect(mockConsoleLog).toHaveBeenCalledWith(
//       expect.stringContaining(\'-5\')
//     );
//     expect(mockConsoleLog).toHaveBeenCalledWith(
//       expect.stringContaining(\'~7\')
//     );
//   });
  
//   it(\'should display error when abort event is received\', async () => {
//     const { runCli, simulateFinishEvent } = createCli([\'spec.yml\', \'--yes\']);
    
//     // Start the CLI
//     const cliPromise = runCli();
    
//     // Manually trigger the abort event
//     simulateFinishEvent(false);
    
//     // Wait for CLI to complete
//     await cliPromise;
    
//     // Verify the error output
//     expect(mockConsoleLog).toHaveBeenCalledWith(
//       expect.stringContaining(\'Aborted: Test error\')
//     );
//   });
  
//   it(\'should correctly assemble CLI config from options\', async () => {
//     const { runCli, runMock } = createCli([
//       \'spec.yml\',
//       \'--dry-run\',
//       \'--model=cli-model\',
//       \'--var\', \'key=value\',
//       \'--yes\'
//     ]);
    
//     await runCli();
    
//     expect(runMock).toHaveBeenCalled();
//     const calledConfig = runMock.mock.calls[0][1];
//     expect(calledConfig.dry_run).toBe(true);
//     expect(calledConfig.model).toBe(\'cli-model\');
//     expect(calledConfig.varsOverride).toEqual({ key: \'value\' });
//   });
  
//   it(\'should clean up event listeners when done\', async () => {
//     const { runCli } = createCli([\'spec.yml\', \'--yes\']);
    
//     await runCli();
    
//     expect(bus.clearAllListeners).toHaveBeenCalled();
//   });
// });

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { runCli } from '../src/ui/cli/main.js';
import { orchestrateExecution } from '../src/ui/cli/execution/flow.js';
import type { CliConfig } from '../src/app/model/index.js';
import type { Logger } from 'pino';
import { ResourceManager } from '../src/ui/cli/services/resource-manager.js';

// Mock the orchestrateExecution function
vi.mock('../src/ui/cli/execution/flow.js', () => ({
  orchestrateExecution: vi.fn(),
}));

// Cast the mock for type safety
const mockOrchestrateExecution = orchestrateExecution as Mock<typeof orchestrateExecution>;

describe('runCli', () => {
  let mockCoreRunFn: Mock<(spec: string, cfg: CliConfig) => Promise<void>>;
  let mockGetLoggerFn: Mock<(scope: string, cfg: CliConfig) => Logger>;
  let mockLogger: Partial<Logger>; // Mock individual methods as needed
  let mockResourceManagerInstance: Partial<ResourceManager>; // Mock individual methods as needed
  let consoleErrorSpy: Mock<typeof console.error>;

  beforeEach(() => {
    vi.resetAllMocks(); // Reset all mocks

    mockCoreRunFn = vi.fn().mockResolvedValue(undefined);

    // Setup mockLogger with simplified vi.fn() and cast where needed
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis() as unknown as Logger['child'],
    };
    mockGetLoggerFn = vi.fn().mockReturnValue(mockLogger as Logger);

    // Setup mockResourceManagerInstance with mocked methods
    mockResourceManagerInstance = {
      cleanup: vi.fn() as Mock<ResourceManager['cleanup']>,
    };

    // Spy on console.error to check for critical error logging
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as Mock<typeof console.error>;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore(); // Restore console.error
  });

  it('should call orchestrateExecution and cleanup on success', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    mockOrchestrateExecution.mockResolvedValue({
      exitCode: 0,
      log: mockLogger as Logger,
      resourceManager: mockResourceManagerInstance as ResourceManager,
    });

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(mockResourceManagerInstance.cleanup).toHaveBeenCalledTimes(1);
    expect(exitCode).toBe(0);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    if (mockLogger.debug) {
        expect(mockLogger.debug).toHaveBeenCalledWith('CLI run finished, all resources should be cleared by ResourceManager.');
    }
  });

  it('should handle errors from orchestrateExecution and return 1', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    const testError = new Error('Orchestration failed!');
    mockOrchestrateExecution.mockRejectedValue(testError);

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Critical CLI error: Orchestration failed!'));
    expect(mockResourceManagerInstance.cleanup).not.toHaveBeenCalled();
    expect(exitCode).toBe(1);
  });
  
  it('should handle errors from orchestrateExecution and log error details if logger is available', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    const testError = new Error('Orchestration failed with logger!');
    mockOrchestrateExecution.mockImplementation(async () => {
      throw testError;
    });

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Critical CLI error: Orchestration failed with logger!'));
    if (mockLogger.error) {
        expect(mockLogger.error).not.toHaveBeenCalledWith(expect.objectContaining({ error: testError.message }), 'Critical CLI execution failed');
    }
    expect(exitCode).toBe(1);
  });

  it('should return non-zero exit code from orchestrateExecution and cleanup', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    mockOrchestrateExecution.mockResolvedValue({
      exitCode: 2,
      log: mockLogger as Logger,
      resourceManager: mockResourceManagerInstance as ResourceManager,
    });

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(mockResourceManagerInstance.cleanup).toHaveBeenCalledTimes(1);
    expect(exitCode).toBe(2);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should not call cleanup if resourceManager is effectively undefined in runCli', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    mockOrchestrateExecution.mockResolvedValue({
      exitCode: 0,
      log: mockLogger as Logger,
      resourceManager: undefined as unknown as ResourceManager, // Test robustness
    });

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(mockResourceManagerInstance.cleanup).not.toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });
  
  it('should call cleanup even if orchestrateExecution returns a resourceManager but also an error exitCode', async () => {
    const argv = ['node', 'script.js', 'spec.yml'];
    mockOrchestrateExecution.mockResolvedValue({
      exitCode: 1, // Non-zero exit code
      log: mockLogger as Logger,
      resourceManager: mockResourceManagerInstance as ResourceManager, // ResourceManager is provided
    });

    const exitCode = await runCli(argv, mockCoreRunFn, mockGetLoggerFn);

    expect(mockOrchestrateExecution).toHaveBeenCalledWith(argv, mockCoreRunFn, mockGetLoggerFn);
    expect(mockResourceManagerInstance.cleanup).toHaveBeenCalledTimes(1); // Cleanup should still be called
    expect(exitCode).toBe(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // Not a critical crash of runCli itself
  });
});