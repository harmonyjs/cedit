// eslint-disable-next-line @typescript-eslint/naming-convention -- Anthropic is a third-party type, cannot rename
import type Anthropic from '@anthropic-ai/sdk';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import type { ToolUse, ToolCommand } from '../../app/model/index.js';
import type { Logger } from 'pino';

/**
 * Extracts content blocks from an Anthropic message stream event.
 *
 * @param chunk - The message stream event from Anthropic.
 * @returns An array of ContentBlock if present, otherwise undefined.
 */
function extractContentBlocksFromChunk(
  chunk: Anthropic.Messages.MessageStreamEvent
): ContentBlock[] | undefined {
  if (chunk.type === 'message_start' && typeof chunk.message.content !== 'undefined' && chunk.message.content !== null) { // Added null/undefined checks
    return chunk.message.content;
  }
  if (
    chunk.type === 'message_delta' &&
    'content' in chunk.delta &&
    Array.isArray(chunk.delta.content)
  ) {
    return chunk.delta.content as ContentBlock[];
  }
  return undefined;
}

/**
 * Generates ToolUse objects from an array of content blocks.
 *
 * @param blocks - The array of ContentBlock from Anthropic.
 * @param logger - The logger instance for logging messages.
 * @returns A generator yielding ToolUse objects.
 */
function* generateToolUsesFromBlocks(
  blocks: ContentBlock[],
  logger: Logger,
): Generator<ToolUse, void> {
  for (const block of blocks) {
    if (block.type === 'tool_use') {
      logger.info(
        {
          id: block.id,
          name: block.name,
          input: block.input,
        },
        `Tool use block received`
      );

      const toolUse: ToolUse = {
        name: block.name,
        type: 'text_editor_20250124', // Assuming this is the only tool type for now
        command: {
          id: block.id,
          ...(typeof block.input === 'object' && block.input !== null ? block.input : {}),
        } as ToolCommand,
      };
      yield toolUse;
    }
  }
}

/**
 * Processes a stream of events from the Anthropic API and yields ToolUse objects.
 *
 * This function handles different types of stream events, extracts tool use requests,
 * and logs relevant information.
 *
 * @param stream - The async iterable stream of events from Anthropic.
 * @param logger - The logger instance for logging messages.
 * @returns An async generator yielding ToolUse objects.
 */
export async function* processAnthropicStream(
  stream: AsyncIterable<Anthropic.Messages.MessageStreamEvent>,
  logger: Logger
): AsyncGenerator<ToolUse> {
  let totalToolUseCount = 0;

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      // Optional: Log or handle text delta if needed (e.g., for verbose output)
      // process.stdout.write(chunk.delta.text);
    } else if (chunk.type === 'message_delta' && chunk.delta.stop_reason === 'tool_use') {
      logger.info('Message stream ended with tool_use stop reason.');
    } else if (chunk.type === 'message_stop') {
      logger.info('Message stream stopped.');
    }

    const currentContentBlocks = extractContentBlocksFromChunk(chunk);

    if (currentContentBlocks) {
      for (const toolUse of generateToolUsesFromBlocks(currentContentBlocks, logger)) {
        yield toolUse;
        totalToolUseCount++;
      }
    }
  }

  if (totalToolUseCount === 0) {
    logger.warn('LLM response finished without yielding any tool uses.');
  }
}
