/**
 * openai.ts — OpenAI Chat Completions implementation of LLMProvider.
 */

import OpenAI from 'openai';
import { config } from '../../config';
import type { LLMProvider } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.openaiModel;
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('[openai] Empty response from API');

    return content.trim();
  }
}
