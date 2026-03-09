/**
 * handler.ts — Orchestrate LLM-based email draft generation.
 *
 * Builds a prompt from the email context + operator reply,
 * delegates to the configured LLMProvider, and returns
 * the generated HTML email body.
 */

import { buildPrompt } from './template';
import { getLLMProvider } from './factory';
import type { ParsedEmail } from '../gmail/parser';

/**
 * Generate a draft HTML email reply using the configured LLM provider.
 *
 * @param email - The original parsed email
 * @param operatorReply - The operator's instructions from Discord
 * @returns Generated HTML email string
 */
export async function generateDraftReply(
  email: Pick<ParsedEmail, 'subject' | 'from' | 'body'>,
  operatorReply: string,
): Promise<string> {
  const prompt = await buildPrompt({
    subject: email.subject,
    from: email.from,
    body: email.body,
    userReply: operatorReply,
  });

  const provider = getLLMProvider();
  const generatedHtml = await provider.generate(prompt);

  console.log(`[llm] Generated draft — ${generatedHtml.length} chars`);
  return generatedHtml;
}
