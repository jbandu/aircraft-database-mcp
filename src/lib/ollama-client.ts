/**
 * Ollama Client
 *
 * Wrapper for Ollama API for local LLM inference
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { createLogger } from './logger.js';
import { getLLMConfig } from './llm-config.js';

const logger = createLogger('ollama-client');

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaClient {
  private client: AxiosInstance;
  private model: string;
  private baseUrl: string;

  constructor() {
    const config = getLLMConfig();

    if (config.provider !== 'ollama') {
      throw new Error('OllamaClient requires provider to be "ollama"');
    }

    this.baseUrl = config.baseUrl!;
    this.model = config.model;

    const timeout = parseInt(process.env['LLM_TIMEOUT_MS'] || '30000', 10);

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout, // Configurable timeout (default 30s)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(`Ollama timeout set to ${timeout}ms`);

    logger.info(`Ollama client initialized: ${this.baseUrl} (model: ${this.model})`);
  }

  /**
   * Generate completion using Ollama
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
      logger.debug(`Sending prompt to Ollama (${prompt.length} chars)`);

      const messages: OllamaMessage[] = [];

      if (options?.system) {
        messages.push({
          role: 'system',
          content: options.system,
        });
      }

      messages.push({
        role: 'user',
        content: prompt,
      });

      const response = await this.client.post<OllamaResponse>('/api/chat', {
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.1,
          num_predict: options?.maxTokens ?? 4096,
        },
      });

      const duration = Date.now() - startTime;
      const content = response.data.message.content;

      logger.info(
        `Ollama response received (${content.length} chars, ${duration}ms, tokens: ${response.data.eval_count || 'N/A'})`
      );

      return content;
    } catch (error) {
      logger.error('Ollama generation failed:', error);

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running? Start it with: ollama serve`
          );
        }

        if (error.response?.status === 404) {
          throw new Error(
            `Model '${this.model}' not found. Pull it with: ollama pull ${this.model}`
          );
        }
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
    });

    try {
      // Try to extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);

      const jsonStr = jsonMatch?.[1] || response;

      return JSON.parse(jsonStr.trim()) as T;
    } catch (error) {
      logger.error('Failed to parse JSON response:', response);
      throw new Error(`Invalid JSON response from Ollama: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if Ollama is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
      logger.warn('Ollama health check failed:', error);
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      logger.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  /**
   * Pull a model
   */
  async pullModel(model: string): Promise<void> {
    logger.info(`Pulling Ollama model: ${model}`);

    try {
      await this.client.post('/api/pull', { name: model });
      logger.info(`Model pulled successfully: ${model}`);
    } catch (error) {
      logger.error(`Failed to pull model ${model}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
let ollamaClientInstance: OllamaClient | null = null;

export function getOllamaClient(): OllamaClient {
  if (!ollamaClientInstance) {
    ollamaClientInstance = new OllamaClient();
  }
  return ollamaClientInstance;
}
