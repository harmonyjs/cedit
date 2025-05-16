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

/**
 * LLM class that wraps the Anthropic Claude SDK
 */
export class LLM {
  private client: Anthropic;
  private cfg: CliConfig;
  private log: ReturnType<typeof getLogger>;

  /**
   * Creates a new LLM instance
   * 
   * @param cfg - CLI configuration
   */
  constructor(cfg: CliConfig) {
    this.cfg = cfg;
    this.log = getLogger('llm');
    
    // Ensure API key is read from environment variable or config
    const apiKey = process.env.ANTHROPIC_API_KEY || cfg.anthropic_api_key;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable or config value not set.');
    }
    
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Count tokens of the main prompt text.
   * 
   * @param payload - The text to count tokens for
   * @returns The number of tokens in the text
   */
  private countTokens(payload: string): number {
    // Note: This is a simplified count. A more accurate count would
    // need to serialize the entire API request structure including tools.
    // For now, we estimate based on the main text + a fixed overhead for tools.
    return tokenizer.encode(payload).length;
  }

  /**
   * Send Spec to Claude and yield ToolUse objects as they arrive.
   * 
   * @param spec - The specification to send to Claude
   * @returns An async iterable of ToolUse objects
   */
  async *sendPrompt(spec: Spec): AsyncGenerator<ToolUse> {
    const promptText = `${spec.system}\n\n---\n\n${spec.user}`;
    // Simplified token counting - add a fixed overhead for tool definitions
    const estimatedToolOverhead = 700; // Adjust as needed
    const total = this.countTokens(promptText) + estimatedToolOverhead;

    this.log.info({ estimatedTokens: total }, 'Estimated token count for prompt');

    const maxTokens = this.cfg.max_tokens || 4096; // Default to 4096 if not specified
    if (total > maxTokens) {
      throw new Error(`Input too large: estimated ${total} tokens (limit ${maxTokens})`);
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- async is required by p-retry
    const task = async (): Promise<AsyncGenerator<ToolUse>> => {
      this.log.info({ model: this.cfg.model }, 'Sending request to Anthropic API');
      
      // Define the async generator function that will handle the stream
      const streamProcessingGenerator = async function* (this: LLM): AsyncGenerator<ToolUse> {
        const stream = await this.client.messages.create({
          model: this.cfg.model || 'claude-3-sonnet-20240229',
          stream: true,
          system: spec.system,
          messages: [{ role: 'user', content: spec.user }],
          tools: [TEXT_EDITOR_TOOL_DEFINITION], // Use the imported constant
          max_tokens: maxTokens,
        });

        // Delegate stream processing to the new function from llm-stream-parser.ts
        yield* processAnthropicStream(stream, this.log);
      }.bind(this); // Bind the context of LLM to the generator function
      
      // Return the invoked generator. Since task is async, it will be wrapped in a Promise.
      return streamProcessingGenerator();
    };

    // Wrap in p-retry with exponential backoff
    const retryCount = this.cfg.retries || 3; // Default to 3 retries if not specified
    const sleepMs = this.cfg.sleep_between_requests_ms || 0; // Default to 0 if not specified
    
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
        },
        retries: retryCount,
      });
      
      yield* generator;
    } catch (error) {
      this.log.error({ error }, 'Failed to get response from LLM after retries');
      throw error;
    }
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