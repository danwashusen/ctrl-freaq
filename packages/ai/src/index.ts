/**
 * @ctrl-freaq/ai - AI and LLM integration library
 * 
 * This package provides AI and LLM integration capabilities for CTRL FreaQ
 * using the Vercel AI SDK. It supports multiple AI providers and models
 * for content generation, analysis, and processing.
 */

// Core AI functionality exports
export * from './providers/index.js';
export * from './utils/index.js';

// CLI export
export { cli } from './cli.js';

// Core types and interfaces
export interface AIProvider {
  name: string;
  model: string;
  apiKey?: string;
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GenerationResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

// Placeholder implementation classes
export class AIService {
  constructor(private provider: AIProvider) {}

  async generate(prompt: string, _options?: GenerationOptions): Promise<GenerationResult> {
    // Placeholder implementation
    return {
      content: `Generated content for prompt: ${prompt}`,
      model: this.provider.model,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    };
  }
}

export class ModelRegistry {
  private static models = new Map<string, AIProvider>();

  static register(name: string, provider: AIProvider): void {
    this.models.set(name, provider);
  }

  static get(name: string): AIProvider | undefined {
    return this.models.get(name);
  }

  static list(): string[] {
    return Array.from(this.models.keys());
  }
}

// Package metadata
export const packageInfo = {
  name: '@ctrl-freaq/ai',
  version: '0.1.0',
  description: 'AI and LLM integration library for CTRL FreaQ using Vercel AI SDK'
};
