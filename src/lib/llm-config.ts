/**
 * LLM Configuration
 *
 * Centralized configuration for LLM providers (Ollama for dev, Claude for prod)
 */

import dotenv from 'dotenv';

dotenv.config();

export type LLMProvider = 'ollama' | 'claude';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const LLM_MODE = (process.env.LLM_MODE as LLMProvider) || 'ollama';

export const LLM_CONFIGS: Record<string, LLMConfig> = {
  development: {
    provider: 'ollama',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    temperature: 0.1, // Low temperature for consistent extraction
    maxTokens: 4096,
  },
  production: {
    provider: 'claude',
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    apiKey: process.env.CLAUDE_API_KEY,
    temperature: 0.1,
    maxTokens: 4096,
  },
};

/**
 * Get active LLM configuration based on environment
 */
export function getLLMConfig(): LLMConfig {
  // Allow override via LLM_MODE env var
  if (LLM_MODE === 'claude') {
    return LLM_CONFIGS.production;
  }

  if (LLM_MODE === 'ollama') {
    return LLM_CONFIGS.development;
  }

  // Default based on NODE_ENV
  return LLM_CONFIGS[NODE_ENV] || LLM_CONFIGS.development;
}

/**
 * Validate LLM configuration
 */
export function validateLLMConfig(config: LLMConfig): boolean {
  if (config.provider === 'claude' && !config.apiKey) {
    throw new Error('CLAUDE_API_KEY is required for Claude provider');
  }

  if (config.provider === 'ollama' && !config.baseUrl) {
    throw new Error('OLLAMA_BASE_URL is required for Ollama provider');
  }

  return true;
}

/**
 * Get model name for logging
 */
export function getModelName(): string {
  const config = getLLMConfig();
  return `${config.provider}/${config.model}`;
}
