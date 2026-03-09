/**
 * factory.ts — Return the configured LLMProvider instance.
 *
 * Reads LLM_PROVIDER env var (default: "openai") and returns
 * the corresponding implementation.
 */

import { config } from '../config';
import type { LLMProvider } from './types';
import { OpenAIProvider } from './providers/openai';

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;

  const providerName = config.llmProvider;

  switch (providerName) {
    case 'openai':
      _provider = new OpenAIProvider();
      break;
    default:
      throw new Error(`[llm] Unknown LLM_PROVIDER: "${providerName}". Supported: openai`);
  }

  console.log(`[llm] Using provider: ${providerName}`);
  return _provider;
}
