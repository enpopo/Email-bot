/**
 * template.ts — Load and interpolate the HTML email reply template.
 *
 * Replaces {{subject}}, {{from}}, {{body}}, {{userReply}} placeholders
 * to build the LLM prompt context.
 */

import { join } from 'node:path';

let _templateContent: string | null = null;

async function loadTemplate(): Promise<string> {
  if (_templateContent) return _templateContent;

  const templatePath = join(import.meta.dir, '../../templates/email-reply.html');
  const file = Bun.file(templatePath);
  _templateContent = await file.text();
  return _templateContent;
}

export interface TemplateContext {
  subject: string;
  from: string;
  body: string;
  userReply: string;
}

/**
 * Build the LLM prompt by injecting email context into the template.
 */
export async function buildPrompt(context: TemplateContext): Promise<string> {
  const template = await loadTemplate();

  return `You are a professional email assistant. Write a polished, professional HTML email reply based on the following context.

Original email details:
- Subject: ${context.subject}
- From: ${context.from}
- Body:
${context.body}

Operator instructions for the reply:
${context.userReply}

Use the following HTML template structure. Replace {{generatedContent}} with your response — write only the body content (no <html>/<body> wrapper tags, just the inner content). Keep it professional, concise, and friendly.

${template}

Return ONLY the complete HTML document. No markdown, no code fences, no explanation.`;
}
