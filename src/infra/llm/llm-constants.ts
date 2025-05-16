/**
 * Constants for the LLM module.
 */

/**
 * Defines the structure of the text editor tool expected by the Anthropic Claude API.
 * This tool allows the LLM to request operations like viewing files, replacing strings,
 * inserting content, creating files, or undoing previous edits.
 */
export const TEXT_EDITOR_TOOL_DEFINITION = {
  name: 'text_editor_20250124', // Unique name for the tool
  description:
    'Tool for viewing and modifying files. Use commands like view, str_replace, insert, create, undo_edit.',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['view', 'str_replace', 'insert', 'create', 'undo_edit'],
        description: 'The type of edit operation to perform.',
      },
      path: {
        type: 'string',
        description: 'Relative path to the file.',
      },
      // Properties for str_replace
      lineFrom: {
        type: 'number',
        description: 'Start line number (0-indexed).',
      },
      lineTo: {
        type: 'number',
        description: 'End line number (0-indexed, inclusive).',
      },
      content: {
        type: 'string',
        description: 'New content to insert/replace.',
      },
      // Property for insert
      after: {
        type: 'number',
        description: 'Line number (0-indexed) after which to insert.',
      },
      // Properties for view (lineFrom, lineTo are optional for view)
    },
    required: ['kind', 'path'], // Base requirements for all commands
  },
} as const;
