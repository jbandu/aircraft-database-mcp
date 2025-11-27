/**
 * Unified LLM Client
 *
 * Provides a unified interface for both Ollama and Claude
 */

import { getLLMConfig, getModelName } from './llm-config.js';
import { getOllamaClient } from './ollama-client.js';
import { getClaudeClient } from './claude-client.js';
import { createLogger } from './logger.js';

const logger = createLogger('llm-client');

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  system?: string;
}

export class UnifiedLLMClient {
  /**
   * Generate text completion
   */
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const config = getLLMConfig();
    logger.debug(`Using ${getModelName()} for generation`);

    if (config.provider === 'ollama') {
      const client = getOllamaClient();
      return await client.generate(prompt, options);
    } else {
      const client = getClaudeClient();
      return await client.generate(prompt, options);
    }
  }

  /**
   * Generate structured JSON response
   */
  async generateJSON<T = any>(
    prompt: string,
    options?: LLMGenerateOptions
  ): Promise<T> {
    const config = getLLMConfig();
    logger.debug(`Using ${getModelName()} for JSON generation`);

    if (config.provider === 'ollama') {
      const client = getOllamaClient();
      return await client.generateJSON<T>(prompt, options);
    } else {
      const client = getClaudeClient();
      return await client.generateJSON<T>(prompt, options);
    }
  }

  /**
   * Health check for active LLM provider
   */
  async healthCheck(): Promise<boolean> {
    const config = getLLMConfig();

    try {
      if (config.provider === 'ollama') {
        const client = getOllamaClient();
        return await client.healthCheck();
      } else {
        const client = getClaudeClient();
        return await client.healthCheck();
      }
    } catch (error) {
      logger.error('LLM health check failed:', error);
      return false;
    }
  }

  /**
   * Get current model name
   */
  getModelName(): string {
    return getModelName();
  }
}

// Export singleton instance
let llmClientInstance: UnifiedLLMClient | null = null;

export function getLLMClient(): UnifiedLLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new UnifiedLLMClient();
  }
  return llmClientInstance;
}
