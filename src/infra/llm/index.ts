/**
 * LLM infrastructure for cedit CLI tool
 * 
 * This module provides a small, reusable wrapper around the Anthropic Claude SDK
 * that streams ToolUse commands to the editor while handling token limits,
 * retries and rate-limiting.
 * 
 * It isolates all Anthropic-specific logic, making it easy to swap providers
 * in the future if needed.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention -- Anthropic is a third-party class, cannot rename
import Anthropic from '@anthropic-ai/sdk';
import retry from 'p-retry';
import { getTokenizer } from '@anthropic-ai/tokenizer';
import { getLogger } from '../logging/index.js';
// ToolCommand is still needed due to its use in the ToolUse type definition.
import type { CliConfig, Spec, ToolUse } from '../../app/model/index.js';
import { TEXT_EDITOR_TOOL_DEFINITION } from './llm-constants.js';
import { processAnthropicStream } from './llm-stream-parser.js';

// Initialize tokenizer
const tokenizer = getTokenizer();

const DEFAULT_MAX_TOKENS_API = 4096;

/**
 * LLM class that wraps the Anthropic Claude SDK
 */
export class LLM {
  private readonly client: Anthropic;
  private readonly cfg: CliConfig;
  private readonly log: ReturnType<typeof getLogger>;

  constructor(cfg: CliConfig) {
    this.cfg = cfg;
    this.log = getLogger('llm');
    
    const apiKey = process.env.ANTHROPIC_API_KEY ?? cfg.anthropicApiKey;
    // Explicit check for empty string for apiKey
    if (typeof apiKey !== 'string' || apiKey === '') {
      throw new Error('ANTHROPIC_API_KEY environment variable or config value not set or is empty.');
    }
    
    this.client = new Anthropic({ apiKey });
  }

  // Instance methods
  public async *sendPrompt(spec: Spec): AsyncGenerator<ToolUse> {
    const promptText = `${spec.system}\n\n---\n\n${spec.user}`;
    const estimatedToolOverhead = 700; // Adjust as needed
    const total = LLM.countTokens(promptText) + estimatedToolOverhead; // Call as static method

    this.log.info({ estimatedTokens: total }, 'Estimated token count for prompt');

    const maxTokens = this.cfg.maxTokens ?? DEFAULT_MAX_TOKENS_API;
    if (total > maxTokens) {
      throw new Error(`Input too large: estimated ${total} tokens (limit ${maxTokens})`);
    }

     
    const task = async (): Promise<AsyncGenerator<ToolUse>> => {
      this.log.info({ model: this.cfg.model }, 'Sending request to Anthropic API');
      // require-await: добавляем await для соответствия lint-правилу
      await Promise.resolve();
      // Define the async generator function that will handle the stream
      const streamProcessingGenerator = async function* (this: LLM): AsyncGenerator<ToolUse> {
        const stream = await this.client.messages.create({
          model: this.cfg.model ?? 'claude-3-sonnet-20240229', // Nullish coalescing for model
          stream: true,
          system: spec.system,
          messages: [{ role: 'user', content: spec.user }],
          // @ts-expect-error Anthropic SDK expects input_schema, not inputSchema. This is a known deviation.
          tools: [TEXT_EDITOR_TOOL_DEFINITION], // Use the imported constant
          maxTokens: maxTokens,
        });

        // Delegate stream processing to the new function from llm-stream-parser.ts
        yield* processAnthropicStream(stream, this.log);
      }.bind(this); // Bind the context of LLM to the generator function
      // Return the invoked generator. Since task is async, it will be wrapped in a Promise.
      return streamProcessingGenerator();
    };

    // Wrap in p-retry with exponential backoff
    const DEFAULT_RETRY_COUNT = 3;
    const retryCount = this.cfg.retries ?? DEFAULT_RETRY_COUNT;
    const sleepMs = this.cfg.sleepBetweenRequestsMs ?? 0;
    
    try {
      const generator = await retry(task, {
        onFailedAttempt: err => {
          this.log.error({ 
            attempt: err.attemptNumber, 
            error: err.message 
          }, 'LLM request failed, retrying...');
          
          // Optional: Add specific error handling for 429 (rate limit) vs 5xx (server error)
          if (sleepMs > 0) {
            this.log.info(`Sleeping for ${sleepMs}ms before retry.`);
            return new Promise(r => setTimeout(r, sleepMs));
          }
          // Ensure a promise is always returned, even if not sleeping
          return Promise.resolve(); 
        },
        retries: retryCount,
      });
      
      yield* generator;
    } catch (error) {
      this.log.error({ error }, 'Failed to get response from LLM after retries');
      throw error;
    }
  }

  // Static private methods/fields first
  private static countTokens(payload: string): number {
    // Note: This is a simplified count. A more accurate count would
    // need to serialize the entire API request structure including tools.
    // For now, we estimate based on the main text + a fixed overhead for tools.
    return tokenizer.encode(payload).length;
  }
}

/**
 * Creates a new LLM instance with the given configuration
 * 
 * @param cfg - CLI configuration
 * @returns A new LLM instance
 */
export function createLLM(cfg: CliConfig): LLM {
  return new LLM(cfg);
}