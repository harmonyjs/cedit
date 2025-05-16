import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mock from 'mock-fs';
import { handleToolUse } from '../src/app/editor/index.js';
import type { CliConfig, ToolUse, FileEdited, FileViewed } from '../src/app/model/index.js';

// Mock dependencies completely
vi.mock('../src/infra/logging/index.js', async () => {
  return {
    getLogger: () => ({ // Return a mock logger object
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
      bindings: vi.fn().mockReturnValue({ scope: 'editor-test' })
    }),
  };
});

vi.mock('../src/infra/storage/index.js', () => ({
  readFileLines: vi.fn(),
  applyReplace: vi.fn(),
  applyInsert: vi.fn(),
  writeFile: vi.fn(),
  // Don't need to mock makeBackup directly if applyReplace/Insert handle it
}));

const cfg: CliConfig = {
  // Provide necessary config fields, ensure types match model
  anthropic_api_key: 'test-key',
  model: 'test-model',
  retries: 0,
  sleep_between_requests_ms: 0,
  log: { level: 'info', dir: '/log' },
  backup: { dir: '/bak', keep_for_days: 0 },
  defaults: { dry_run: false, max_tokens: 1000 },
  dry_run: true,
  max_tokens: 1000
};

beforeEach(async () => {
  // Reset mocks before each test
  vi.clearAllMocks();
  // Setup mock file system
  mock({
    'note.md': 'line one\nline two\nline three',
    '/bak': {}, // Mock backup directory
    '/log': {}, // Mock log directory
  });
  // Import the mocked storage module AFTER mocks are set up
  const storageMock = await import('../src/infra/storage/index.js');
  // Setup default mock implementations with type assertions
  (storageMock.readFileLines as any).mockResolvedValue(['line one', 'line two', 'line three']);
  (storageMock.applyReplace as any).mockImplementation(async (cmd: any) => ({
      type: 'FileEdited', path: cmd.path, lines: 3, stats: { added: 1, removed: 1, changed: 1 } // Example return
  }));
  (storageMock.applyInsert as any).mockImplementation(async (cmd: any) => ({
      type: 'FileEdited', path: cmd.path, lines: 4, stats: { added: 1, removed: 0, changed: 0 } // Example return
  }));
  (storageMock.writeFile as any).mockResolvedValue(1); // Example return
});

afterEach(() => {
  mock.restore(); // Restore the real file system
});

describe('editor handleToolUse', () => {
  it('handles str_replace by calling storage.applyReplace', async () => {
    const storageMock = await import('../src/infra/storage/index.js');
    const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't1',
        kind: 'str_replace',
        path: 'note.md',
        lineFrom: 1,
        lineTo: 1,
        content: 'TWO'
      }
    };

    const result = await handleToolUse(cmd, cfg);

    expect(storageMock.applyReplace).toHaveBeenCalledWith(cmd.command, cfg);
    expect(result.type).toBe('FileEdited');
    // Add more specific assertions based on mock return if needed
    expect((result as FileEdited).stats?.changed).toBe(1);
  });

  it('handles insert by calling storage.applyInsert', async () => {
    const storageMock = await import('../src/infra/storage/index.js');
     const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't2',
        kind: 'insert',
        path: 'note.md',
        after: 0,
        content: 'one point five'
      }
    };

    const result = await handleToolUse(cmd, cfg);

    expect(storageMock.applyInsert).toHaveBeenCalledWith(cmd.command, cfg);
    expect(result.type).toBe('FileEdited');
    expect((result as FileEdited).stats?.added).toBe(1);
  });

   it('handles create by calling storage.writeFile', async () => {
    const storageMock = await import('../src/infra/storage/index.js');
     const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't3',
        kind: 'create',
        path: 'newfile.txt',
        content: 'hello world'
      }
    };

    const result = await handleToolUse(cmd, cfg);

    expect(storageMock.writeFile).toHaveBeenCalledWith(
      cmd.command.path,
      (cmd.command as any).content,
      cfg
    );
    expect(result.type).toBe('FileEdited'); // Create results in FileEdited
    expect((result as FileEdited).stats?.added).toBe(1); // Or calculate based on content
  });

  it('handles view by calling storage.readFileLines', async () => {
    const storageMock = await import('../src/infra/storage/index.js');
    const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't4',
        kind: 'view',
        path: 'note.md'
      }
    };

    const result = await handleToolUse(cmd, cfg);

    expect(storageMock.readFileLines).toHaveBeenCalledWith(cmd.command.path);
    expect(result.type).toBe('FileViewed');
    expect((result as FileViewed).lines).toBe(3);
  });

  it('returns ErrorRaised for unimplemented undo', async () => {
    const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't5',
        kind: 'undo_edit',
        path: 'note.md'
      }
    };
    const result = await handleToolUse(cmd, cfg);
    expect(result.type).toBe('ErrorRaised');
    expect((result as any).message).toContain('undo_edit not implemented');
  });

  it('returns ErrorRaised for invalid command fields', async () => {
    const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't6',
        kind: 'str_replace',
        path: 'note.md'
        // Missing lineFrom/To/content
      } as any // Type assertion to bypass TypeScript check
    };
    const result = await handleToolUse(cmd, cfg);
    expect(result.type).toBe('ErrorRaised');
    expect((result as any).message).toContain('Invalid str_replace command');
  });

   it('returns ErrorRaised for unknown command kind', async () => {
    const cmd: ToolUse = {
      name: 'text_editor_20250124',
      type: 'text_editor_20250124',
      command: {
        id: 't7',
        kind: 'delete', // Unknown kind
        path: 'note.md'
      } as any
    };
    const result = await handleToolUse(cmd, cfg);
    expect(result.type).toBe('ErrorRaised');
    expect((result as any).message).toContain('Unsupported command kind: delete');
  });
});