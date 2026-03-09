/**
 * types.ts — Abstract LLM provider interface.
 */

export interface LLMProvider {
  /**
   * Generate a response given a prompt string.
   * Returns the generated text content.
   */
  generate(prompt: string): Promise<string>;
}
