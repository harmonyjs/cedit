import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mock from 'mock-fs';
import { run } from '../src/app/runner/index.js';
import type { CliConfig, ToolUse, DomainEvent } from '../src/app/model/index.js';
import { bus, BUS_EVENT_TYPE, type FinishSummaryEvent } from '../src/app/bus/index.js';

// Mock dependencies
vi.mock('../src/infra/logging/index.js', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis(), bindings: vi.fn() })
}));

// Mock LLM to yield specific tool uses
const mockToolUses: ToolUse[] = [];
vi.mock('../src/infra/llm/index.js', () => ({
  createLLM: () => ({
    sendPrompt: async function* () {
      for (const toolUse of mockToolUses) {
        yield toolUse;
      }
    }
  })
}));

// Mock Editor to return specific events
const mockEditorResponses: DomainEvent[] = [];
let editorCallCount = 0;
vi.mock('../src/app/editor/index.js', () => ({
  handleToolUse: vi.fn().mockImplementation(async () => {
      return mockEditorResponses[editorCallCount++] ?? { type: 'ErrorRaised', message: 'Mock editor ran out of responses' };
  })
}));

// Create a base config with varsOverride added via type assertion
const baseCfg = {
  anthropic_api_key: 'test-key',
  model: 'test-model',
  retries: 0,
  sleep_between_requests_ms: 0,
  log: { level: 'error', dir: '/log' }, // Use error level for tests (lowest available)
  backup: { dir: '/bak', keep_for_days: 0 },
  defaults: { dry_run: false, max_tokens: 10000 },
  dry_run: true,
  max_tokens: 10000,
  // Add varsOverride for testing interpolation
  varsOverride: { cliVar: 'cliValue' }
} as CliConfig & { varsOverride: Record<string, string> };

beforeEach(() => {
  vi.clearAllMocks();
  mockToolUses.length = 0; // Clear mock data
  mockEditorResponses.length = 0;
  editorCallCount = 0;
  mock({
    '/log': {},
    '/bak': {},
    'spec.yml': `
system: System prompt with {{var.specVar}} and {{var.cliVar}}
user: User prompt
variables:
  specVar: specValue
attachments: []
    `,
  });
});

afterEach(() => {
  mock.restore();
});

describe('runner run', () => {
  it('loads spec, interpolates, calls LLM, calls editor, and emits events', async () => {
    // Arrange
    mockToolUses.push(
      { name: 'text_editor_20250124', type: 'text_editor_20250124', command: { id: 't1', kind: 'create', path: 'a.txt', content: 'one' } },
      { name: 'text_editor_20250124', type: 'text_editor_20250124', command: { id: 't2', kind: 'insert', path: 'a.txt', after: 0, content: 'two' } }
    );
    mockEditorResponses.push(
      { type: 'FileEdited', path: 'a.txt', lines: 1, stats: { added: 1, removed: 0, changed: 0 } },
      { type: 'FileEdited', path: 'a.txt', lines: 2, stats: { added: 1, removed: 0, changed: 0 } }
    );
    const editorMock = await import('../src/app/editor/index.js');
    
    // Set up event listener to capture finish event
    let finishSummaryReceived = false;
    let finishStats: any = null;
    
    const finishListener = (payload: FinishSummaryEvent) => {
      finishSummaryReceived = true;
      finishStats = payload.stats;
    };
    
    bus.onTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, finishListener);

    // Act
    await run('spec.yml', baseCfg);

    // Assert
    // Check editor calls
    expect(editorMock.handleToolUse).toHaveBeenCalledTimes(2);
    expect(editorMock.handleToolUse).toHaveBeenNthCalledWith(1, mockToolUses[0], baseCfg);
    expect(editorMock.handleToolUse).toHaveBeenNthCalledWith(2, mockToolUses[1], baseCfg);
    
    // Check that finish event was emitted
    expect(finishSummaryReceived).toBe(true);
    expect(finishStats).not.toBeNull();
    // Check that finishStats is not null
    expect(finishStats).not.toBeNull();
    expect(finishStats.totalEdits).toEqual({
      added: 2,
      removed: 0,
      changed: 0
    });
    
    // Clean up event listener
    bus.offTyped(BUS_EVENT_TYPE.FINISH_SUMMARY, finishListener);
  });

  it('handles errors from the editor', async () => {
     // Arrange
    mockToolUses.push({ name: 'text_editor_20250124', type: 'text_editor_20250124', command: { id: 't1', kind: 'create', path: 'a.txt', content: 'one' } });
    mockEditorResponses.push({ type: 'ErrorRaised', message: 'Editor failed' });
    const editorMock = await import('../src/app/editor/index.js');
    
    // Set up event listener to capture domain error events
    let errorEvent: DomainEvent | null = null;
    
    const errorListener = (payload: { timestamp: number; event: DomainEvent }) => {
      if (payload.event.type === 'ErrorRaised') {
        errorEvent = payload.event;
      }
    };
    
    bus.onTyped(BUS_EVENT_TYPE.DOMAIN_ERROR, errorListener);

    // Act
    await run('spec.yml', baseCfg);

    // Assert
    expect(editorMock.handleToolUse).toHaveBeenCalledTimes(1);
    expect(errorEvent).not.toBeNull();
    expect((errorEvent as any)?.message).toBe('Editor failed');
    
    // Clean up event listener
    bus.offTyped(BUS_EVENT_TYPE.DOMAIN_ERROR, errorListener);
  });

   it('handles errors loading the spec file', async () => {
    // Arrange: spec.yml doesn't exist because mock doesn't include it here
    mock({ '/log': {}, '/bak': {} });
    
    // Set up event listener to capture abort event
    let abortReason: string | null = null;
    
    const abortListener = (payload: { timestamp: number; reason: string; code?: string }) => {
      abortReason = payload.reason;
    };
    
    bus.onTyped(BUS_EVENT_TYPE.FINISH_ABORT, abortListener);

    // Act
    await run('spec.yml', baseCfg);

    // Assert
    expect(abortReason).not.toBeNull();
    expect(abortReason).toContain('Runner failed: ENOENT'); // Error from fs.readFile
    
    // Clean up event listener
    bus.offTyped(BUS_EVENT_TYPE.FINISH_ABORT, abortListener);
  });

  // Add test for LLM stream error if possible (might require more complex mocking)
});