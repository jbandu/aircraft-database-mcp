/**
 * Claude API Client
 *
 * Wrapper for Anthropic Claude API for production LLM inference
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from './logger.js';
import { getLLMConfig } from './llm-config.js';

const logger = createLogger('claude-client');

export class ClaudeClient {
  private client: Anthropic;
  private model: string;

  constructor() {
    const config = getLLMConfig();

    if (config.provider !== 'claude') {
      throw new Error('ClaudeClient requires provider to be "claude"');
    }

    if (!config.apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required');
    }

    this.model = config.model;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });

    logger.info(`Claude client initialized (model: ${this.model})`);
  }

  /**
   * Generate completion using Claude
   */
  async generate(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      system?: string;
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      logger.debug(`Sending prompt to Claude (${prompt.length} chars)`);

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.1,
        system: options?.system,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const duration = Date.now() - startTime;
      const content = message.content[0]?.type === 'text' ? message.content[0].text : '';

      logger.info(
        `Claude response received (${content.length} chars, ${duration}ms, tokens: ${message.usage.output_tokens})`
      );

      return content;
    } catch (error) {
      logger.error('Claude generation failed:', error);

      if (error instanceof Anthropic.APIError) {
        if (error.status === 401) {
          throw new Error('Invalid Claude API key. Check CLAUDE_API_KEY environment variable.');
        }

        if (error.status === 429) {
          throw new Error('Claude API rate limit exceeded. Please try again later.');
        }

        throw new Error(`Claude API error (${error.status}): ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Generate structured JSON response
   */
  async generateJSON<T = any>(
    prompt: string,
    options?: {
      temperature?: number;
      system?: string;
    }
  ): Promise<T> {
    const systemPrompt = `${options?.system || ''}\n\nYou must respond with valid JSON only. Do not include any explanatory text before or after the JSON.`;

    const response = await this.generate(prompt, {
      ...options,
      system: systemPrompt,
      maxTokens: 4096,
    });

    try {
      // Try to extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);

      const jsonStr = jsonMatch?.[1] || response;

      return JSON.parse(jsonStr.trim()) as T;
    } catch (error) {
      logger.error('Failed to parse JSON response:', response);
      throw new Error(`Invalid JSON response from Claude: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate with vision (analyze images)
   */
  async generateWithVision(
    prompt: string,
    imageUrl: string,
    options?: {
      temperature?: number;
      system?: string;
    }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      logger.debug(`Sending vision prompt to Claude`);

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: options?.temperature ?? 0.1,
        system: options?.system,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageUrl, // Note: This should be base64-encoded data, not a URL
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      const duration = Date.now() - startTime;
      const content = message.content[0]?.type === 'text' ? message.content[0].text : '';

      logger.info(
        `Claude vision response received (${content.length} chars, ${duration}ms)`
      );

      return content;
    } catch (error) {
      logger.error('Claude vision generation failed:', error);
      throw error;
    }
  }

  /**
   * Check if Claude API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generate('test', { maxTokens: 10 });
      return true;
    } catch (error) {
      logger.warn('Claude health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
let claudeClientInstance: ClaudeClient | null = null;

export function getClaudeClient(): ClaudeClient {
  if (!claudeClientInstance) {
    claudeClientInstance = new ClaudeClient();
  }
  return claudeClientInstance;
}
